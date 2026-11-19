import * as THREE from 'three';
import { aiTakeTurn } from './core/ai';
import { createHeroSetup, getClass } from './core/character';
import {
  attack,
  attackableTargets,
  createCombat,
  currentUnit,
  endTurn,
  getUnit,
  moveUnit,
} from './core/combat';
import { formatDice } from './core/dice';
import { chebyshev, reachableTiles } from './core/grid';
import { createRng } from './core/rng';
import type { CombatEvent, CombatState, Vec2 } from './core/types';
import { HERO_START, createArena, createEnemies } from './content/encounter';
import { createBoard, type Board } from './render/board';
import { createScene, tileToWorld } from './render/scene';
import { createUnitView, spawnFloatingText, updateHpBar, type UnitView } from './render/units';
import { delay, tween, updateTweens } from './render/tween';
import { createHud, type Hud } from './ui/hud';
import { showCharacterCreator, type CreationResult } from './ui/creator';

/* ---------------------------------- scene ---------------------------------- */

const container = document.getElementById('game')!;
const ctx = createScene(container);

function renderLoop(now: number) {
  updateTweens(now);
  ctx.renderer.render(ctx.scene, ctx.camera);
  ctx.labelRenderer.render(ctx.scene, ctx.camera);
  requestAnimationFrame(renderLoop);
}
requestAnimationFrame(renderLoop);

/* ------------------------------- game session ------------------------------- */

interface Game {
  state: CombatState;
  board: Board;
  hud: Hud;
  unitViews: Map<string, UnitView>;
  grid: ReturnType<typeof createArena>;
}

let game: Game | null = null;
let animating = false;

function startGame(creation: CreationResult): void {
  const hud = createHud(document.getElementById('hud')!);
  const rng = createRng(Date.now() % 2147483647);
  const grid = createArena();
  const hero = createHeroSetup(creation.name, creation.classId, creation.scores, HERO_START);
  const { state, events } = createCombat(grid, [hero, ...createEnemies()], rng);

  const board = createBoard(grid);
  ctx.scene.add(board.group);

  const unitViews = new Map<string, UnitView>();
  for (const unit of state.units) {
    const view = createUnitView(grid, unit);
    unitViews.set(unit.id, view);
    ctx.scene.add(view.root);
  }

  game = { state, board, hud, unitViews, grid };

  hud.onEndTurn(() => {
    if (!game || animating || game.state.over) return;
    if (currentUnit(game.state).faction !== 'party') return;
    void playEvents(endTurn(game.state));
  });

  const cls = getClass(creation.classId);
  const h = getUnit(state, 'hero');
  hud.log(
    `You are <b>${h.name}</b> the ${cls.name} — HP ${h.stats.maxHp}, AC ${h.stats.ac}, ` +
      `${cls.weapon.name.toLowerCase()} ${formatDice(h.stats.damage)}` +
      (h.stats.attackRange > 1 ? ` (range ${h.stats.attackRange})` : '') +
      `.`,
  );
  void playEvents(events);
}

/* ----------------------------- event animation ----------------------------- */

async function playEvents(events: CombatEvent[]): Promise<void> {
  if (!game) return;
  animating = true;
  game.board.clearHighlights();
  for (const ev of events) {
    await animateEvent(game, ev);
  }
  animating = false;
  refresh();
}

async function animateEvent(g: Game, ev: CombatEvent): Promise<void> {
  const { state, hud, unitViews, grid } = g;
  switch (ev.type) {
    case 'combatStart': {
      const names = ev.order.map((id) => getUnit(state, id).name).join(' → ');
      hud.log(`<b>⚔️ Combat begins!</b> Initiative: ${names}`);
      break;
    }
    case 'roundStart':
      hud.log(`<b>— Round ${ev.round} —</b>`);
      break;
    case 'turnStart': {
      const unit = getUnit(state, ev.unitId);
      for (const [id, v] of unitViews) v.ring.visible = id === ev.unitId && unit.alive;
      hud.setTurn(state, unit);
      break;
    }
    case 'move': {
      const view = unitViews.get(ev.unitId)!;
      for (const step of ev.path) {
        const from = view.root.position.clone();
        const to = tileToWorld(grid, step);
        await tween(130, (t) => {
          view.root.position.lerpVectors(from, to, t);
          // tiny hop
          view.root.position.y = Math.sin(t * Math.PI) * 0.12;
        });
      }
      view.root.position.y = 0;
      break;
    }
    case 'attack': {
      const attacker = getUnit(state, ev.attackerId);
      const target = getUnit(state, ev.targetId);
      const view = unitViews.get(ev.attackerId)!;
      // lunge toward target
      const from = view.root.position.clone();
      const toward = tileToWorld(grid, target.pos).sub(from).multiplyScalar(0.3).add(from);
      await tween(120, (t) => view.root.position.lerpVectors(from, toward, t));
      await tween(120, (t) => view.root.position.lerpVectors(toward, from, t));

      const r = ev.roll;
      const rollTxt = `d20: <b>${r.d20}</b> + ${r.bonus} = <b>${r.total}</b> vs AC ${r.targetAc}`;
      if (r.crit) {
        hud.log(`💥 <b>${attacker.name}</b> CRITS <b>${target.name}</b>! (${rollTxt})`);
        spawnFloatingText(grid, ctx.scene, target.pos, 'CRIT!', 'crit');
      } else if (r.fumble) {
        hud.log(`🎲 <b>${attacker.name}</b> fumbles! Natural 1. (${rollTxt})`);
        spawnFloatingText(grid, ctx.scene, attacker.pos, 'Fumble!', 'miss');
      } else if (r.hit) {
        hud.log(`🗡️ <b>${attacker.name}</b> hits <b>${target.name}</b>. (${rollTxt})`);
      } else {
        hud.log(`🛡️ <b>${attacker.name}</b> misses <b>${target.name}</b>. (${rollTxt})`);
        spawnFloatingText(grid, ctx.scene, target.pos, 'Miss', 'miss');
      }
      break;
    }
    case 'damage': {
      const target = getUnit(state, ev.targetId);
      const view = unitViews.get(ev.targetId)!;
      updateHpBar(view, ev.remainingHp, target.stats.maxHp);
      spawnFloatingText(grid, ctx.scene, target.pos, `-${ev.amount}`, 'damage');
      hud.log(`&nbsp;&nbsp;↳ <b>${ev.amount}</b> damage (${ev.remainingHp}/${target.stats.maxHp} HP)`);
      // flash white
      const mat = view.mesh.material as THREE.MeshStandardMaterial;
      const orig = mat.color.clone();
      mat.color.set(0xffffff);
      await delay(90);
      mat.color.copy(orig);
      break;
    }
    case 'death': {
      const unit = getUnit(state, ev.unitId);
      const view = unitViews.get(ev.unitId)!;
      hud.log(`☠️ <b>${unit.name}</b> dies!`);
      view.ring.visible = false;
      await tween(400, (t) => {
        view.root.scale.setScalar(1 - t * 0.9);
        view.root.rotation.z = (t * Math.PI) / 2;
      });
      ctx.scene.remove(view.root);
      break;
    }
    case 'combatEnd': {
      if (ev.victor === 'party') {
        hud.showBanner('VICTORY', 'victory');
        hud.log('<b>🏆 Victory! The party survives… this time.</b>');
      } else {
        hud.showBanner('THE PARTY HAS FALLEN', 'defeat');
        hud.log('<b>💀 Defeat. The dungeon claims another hero.</b>');
      }
      hud.setHint('Refresh the page to create a new hero.');
      break;
    }
  }
}

/* ------------------------------ player control ------------------------------ */

function refresh(): void {
  if (!game) return;
  const { state, board, hud } = game;
  board.clearHighlights();
  if (state.over) {
    hud.setEndTurnEnabled(false);
    return;
  }

  const unit = currentUnit(state);
  if (unit.faction === 'enemy') {
    hud.setEndTurnEnabled(false);
    void runEnemyTurn();
    return;
  }

  hud.setEndTurnEnabled(true);
  const hints: string[] = [];

  if (!unit.moved) {
    const tiles = [...reachableTiles(state, unit).values()].map((p) => p[p.length - 1]);
    board.setHighlights(tiles, 0x4fd97a);
    hints.push('click a green tile to move');
  }
  if (!unit.acted) {
    const targets = attackableTargets(state, unit);
    if (targets.length > 0) {
      board.setHighlights(targets.map((t) => t.pos), 0xff5544);
      hints.push('click a red tile to attack');
    }
  }
  if (hints.length === 0) hints.push('no actions left — end your turn');
  hud.setHint(`${unit.name}: ${hints.join(' • ')}`);
}

async function runEnemyTurn(): Promise<void> {
  if (!game) return;
  await delay(400);
  const unit = currentUnit(game.state);
  const events = aiTakeTurn(game.state, unit);
  await playEvents(events);
  if (!game.state.over) {
    await playEvents(endTurn(game.state));
  }
}

function onTileClick(tile: Vec2): void {
  if (!game || animating || game.state.over) return;
  const { state } = game;
  const unit = currentUnit(state);
  if (unit.faction !== 'party') return;

  // attack if an enemy stands there and is in range
  const target = state.units.find(
    (u) => u.alive && u.pos.x === tile.x && u.pos.y === tile.y && u.faction === 'enemy',
  );
  if (target && !unit.acted && chebyshev(unit.pos, target.pos) <= unit.stats.attackRange) {
    void playEvents(attack(state, unit.id, target.id));
    return;
  }

  // otherwise try to move
  if (!unit.moved) {
    const events = moveUnit(state, unit.id, tile);
    if (events.length > 0) void playEvents(events);
  }
}

ctx.renderer.domElement.addEventListener('click', (e: MouseEvent) => {
  if (!game) return;
  const ndc = new THREE.Vector2(
    (e.clientX / window.innerWidth) * 2 - 1,
    -(e.clientY / window.innerHeight) * 2 + 1,
  );
  ctx.raycaster.setFromCamera(ndc, ctx.camera);
  const hits = ctx.raycaster.intersectObjects(
    [...game.board.tileMeshes, ...[...game.unitViews.values()].map((v) => v.mesh)],
    true,
  );
  for (const hit of hits) {
    // walk up to find a tile, or map a unit mesh to its tile
    let obj: THREE.Object3D | null = hit.object;
    while (obj) {
      const tile = game.board.tileAt(obj);
      if (tile) {
        onTileClick(tile);
        return;
      }
      obj = obj.parent;
    }
    // clicked a unit mesh: find which unit
    for (const [id, view] of game.unitViews) {
      if (view.mesh === hit.object || view.mesh.children.includes(hit.object)) {
        onTileClick(getUnit(game.state, id).pos);
        return;
      }
    }
  }
});

/* --------------------------------- kick off --------------------------------- */

void showCharacterCreator(document.getElementById('creator-root')!).then((result) => {
  startGame(result);
});
