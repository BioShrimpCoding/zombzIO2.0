import { rollDice, rollDie } from './dice';
import { chebyshev, reachableTiles, tileKey } from './grid';
import type { Rng } from './rng';
import type {
  AttackRoll,
  CombatEvent,
  CombatState,
  Faction,
  GridSpec,
  Unit,
  UnitStats,
  Vec2,
} from './types';

export interface UnitSetup {
  id: string;
  name: string;
  faction: Faction;
  pos: Vec2;
  stats: UnitStats;
}

export function createCombat(
  grid: GridSpec,
  setups: UnitSetup[],
  rng: Rng,
): { state: CombatState; events: CombatEvent[] } {
  const units: Unit[] = setups.map((s) => ({
    id: s.id,
    name: s.name,
    faction: s.faction,
    pos: { ...s.pos },
    hp: s.stats.maxHp,
    stats: s.stats,
    initiative: rollDie(rng, 20) + s.stats.initiativeBonus,
    alive: true,
    moved: false,
    acted: false,
  }));

  const turnOrder = [...units]
    .sort((a, b) => b.initiative - a.initiative)
    .map((u) => u.id);

  const state: CombatState = {
    grid,
    units,
    turnOrder,
    turnIndex: 0,
    round: 1,
    over: false,
    victor: null,
    rng,
  };

  const events: CombatEvent[] = [
    { type: 'combatStart', order: turnOrder },
    { type: 'roundStart', round: 1 },
    { type: 'turnStart', unitId: turnOrder[0] },
  ];
  return { state, events };
}

export function getUnit(state: CombatState, id: string): Unit {
  const u = state.units.find((u) => u.id === id);
  if (!u) throw new Error(`Unknown unit: ${id}`);
  return u;
}

export function currentUnit(state: CombatState): Unit {
  return getUnit(state, state.turnOrder[state.turnIndex]);
}

export function attackableTargets(state: CombatState, unit: Unit): Unit[] {
  return state.units.filter(
    (t) =>
      t.alive &&
      t.faction !== unit.faction &&
      chebyshev(unit.pos, t.pos) <= unit.stats.attackRange,
  );
}

export function moveUnit(state: CombatState, unitId: string, dest: Vec2): CombatEvent[] {
  const unit = getUnit(state, unitId);
  if (state.over || !unit.alive || unit.moved) return [];
  const paths = reachableTiles(state, unit);
  const path = paths.get(tileKey(dest));
  if (!path) return [];
  unit.pos = { ...dest };
  unit.moved = true;
  return [{ type: 'move', unitId, path }];
}

export function attack(state: CombatState, attackerId: string, targetId: string): CombatEvent[] {
  const attacker = getUnit(state, attackerId);
  const target = getUnit(state, targetId);
  if (state.over || !attacker.alive || !target.alive || attacker.acted) return [];
  if (attacker.faction === target.faction) return [];
  if (chebyshev(attacker.pos, target.pos) > attacker.stats.attackRange) return [];

  attacker.acted = true;
  return resolveAttack(state, attacker, target);
}

function resolveAttack(state: CombatState, attacker: Unit, target: Unit): CombatEvent[] {
  const r = state.rng;
  const d20 = rollDie(r, 20);
  const crit = d20 === 20;
  const fumble = d20 === 1;
  const total = d20 + attacker.stats.attackBonus;
  const hit = !fumble && (crit || total >= target.stats.ac);

  const roll: AttackRoll = {
    d20,
    bonus: attacker.stats.attackBonus,
    total,
    targetAc: target.stats.ac,
    hit,
    crit,
    fumble,
    damage: null,
  };

  const events: CombatEvent[] = [];
  if (hit) {
    // Crits double the damage dice (not the bonus).
    const spec = crit
      ? { ...attacker.stats.damage, count: attacker.stats.damage.count * 2 }
      : attacker.stats.damage;
    const dmg = rollDice(r, spec);
    roll.damage = dmg;
    target.hp = Math.max(0, target.hp - dmg.total);
    events.push({ type: 'attack', attackerId: attacker.id, targetId: target.id, roll });
    events.push({ type: 'damage', targetId: target.id, amount: dmg.total, remainingHp: target.hp });
    if (target.hp === 0) {
      target.alive = false;
      events.push({ type: 'death', unitId: target.id });
      const end = checkEnd(state);
      if (end) events.push(end);
    }
  } else {
    events.push({ type: 'attack', attackerId: attacker.id, targetId: target.id, roll });
  }
  return events;
}

function checkEnd(state: CombatState): CombatEvent | null {
  const partyAlive = state.units.some((u) => u.faction === 'party' && u.alive);
  const enemyAlive = state.units.some((u) => u.faction === 'enemy' && u.alive);
  if (partyAlive && enemyAlive) return null;
  state.over = true;
  state.victor = partyAlive ? 'party' : 'enemy';
  return { type: 'combatEnd', victor: state.victor };
}

export function endTurn(state: CombatState): CombatEvent[] {
  if (state.over) return [];
  const events: CombatEvent[] = [];
  const n = state.turnOrder.length;
  for (let i = 1; i <= n; i++) {
    const idx = (state.turnIndex + i) % n;
    const unit = getUnit(state, state.turnOrder[idx]);
    if (!unit.alive) continue;
    if (idx <= state.turnIndex) {
      state.round += 1;
      events.push({ type: 'roundStart', round: state.round });
    }
    state.turnIndex = idx;
    unit.moved = false;
    unit.acted = false;
    events.push({ type: 'turnStart', unitId: unit.id });
    return events;
  }
  return events;
}
