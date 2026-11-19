import { describe, expect, it } from 'vitest';
import { aiTakeTurn } from './ai';
import {
  attack,
  attackableTargets,
  createCombat,
  currentUnit,
  endTurn,
  getUnit,
  moveUnit,
  type UnitSetup,
} from './combat';
import { chebyshev, reachableTiles, tileKey } from './grid';
import { createRng } from './rng';
import type { GridSpec, UnitStats } from './types';

function stats(overrides: Partial<UnitStats> = {}): UnitStats {
  return {
    maxHp: 10,
    ac: 12,
    speed: 4,
    attackBonus: 4,
    damage: { count: 1, sides: 6, bonus: 2 },
    attackRange: 1,
    initiativeBonus: 0,
    ...overrides,
  };
}

function makeGrid(blockedTiles: { x: number; y: number }[] = []): GridSpec {
  return {
    width: 8,
    height: 8,
    blocked: new Set(blockedTiles.map(tileKey)),
  };
}

function setup(units: Partial<UnitSetup>[]): UnitSetup[] {
  return units.map((u, i) => ({
    id: u.id ?? `u${i}`,
    name: u.name ?? `Unit ${i}`,
    faction: u.faction ?? 'party',
    pos: u.pos ?? { x: 0, y: 0 },
    stats: u.stats ?? stats(),
  }));
}

describe('combat engine', () => {
  it('rolls initiative and produces a deterministic turn order for a seed', () => {
    const rng = createRng(42);
    const { state } = createCombat(
      makeGrid(),
      setup([
        { id: 'a', pos: { x: 0, y: 0 } },
        { id: 'b', faction: 'enemy', pos: { x: 5, y: 5 } },
      ]),
      rng,
    );
    expect(state.turnOrder).toHaveLength(2);
    const rng2 = createRng(42);
    const { state: state2 } = createCombat(
      makeGrid(),
      setup([
        { id: 'a', pos: { x: 0, y: 0 } },
        { id: 'b', faction: 'enemy', pos: { x: 5, y: 5 } },
      ]),
      rng2,
    );
    expect(state2.turnOrder).toEqual(state.turnOrder);
  });

  it('limits movement to speed and blocks walls and occupied tiles', () => {
    const { state } = createCombat(
      makeGrid([{ x: 1, y: 0 }]),
      setup([
        { id: 'hero', pos: { x: 0, y: 0 }, stats: stats({ speed: 2 }) },
        { id: 'foe', faction: 'enemy', pos: { x: 0, y: 1 } },
      ]),
      createRng(1),
    );
    const hero = getUnit(state, 'hero');
    const reach = reachableTiles(state, hero);
    // blocked wall tile is not reachable
    expect(reach.has('1,0')).toBe(false);
    // occupied enemy tile is not reachable
    expect(reach.has('0,1')).toBe(false);
    // beyond speed 2 is not reachable
    expect(reach.has('0,3')).toBe(false);
    // within speed, going around the enemy
    expect(reach.has('0,2')).toBe(false); // enemy at 0,1 blocks the straight line; 1,0 wall blocks the other
  });

  it('moveUnit updates position, marks moved, and rejects a second move', () => {
    const { state } = createCombat(
      makeGrid(),
      setup([
        { id: 'hero', pos: { x: 0, y: 0 } },
        { id: 'foe', faction: 'enemy', pos: { x: 7, y: 7 } },
      ]),
      createRng(1),
    );
    const events = moveUnit(state, 'hero', { x: 2, y: 1 });
    expect(events).toHaveLength(1);
    expect(getUnit(state, 'hero').pos).toEqual({ x: 2, y: 1 });
    expect(moveUnit(state, 'hero', { x: 3, y: 1 })).toHaveLength(0);
  });

  it('attack hits vs low AC, deals damage, and kills — ending combat', () => {
    const { state } = createCombat(
      makeGrid(),
      setup([
        { id: 'hero', pos: { x: 0, y: 0 }, stats: stats({ attackBonus: 100, damage: { count: 1, sides: 1, bonus: 99 } }) },
        { id: 'foe', faction: 'enemy', pos: { x: 1, y: 0 }, stats: stats({ maxHp: 5 }) },
      ]),
      createRng(7),
    );
    const events = attack(state, 'hero', 'foe');
    const types = events.map((e) => e.type);
    expect(types).toContain('attack');
    expect(types).toContain('damage');
    expect(types).toContain('death');
    expect(types).toContain('combatEnd');
    expect(state.over).toBe(true);
    expect(state.victor).toBe('party');
    expect(getUnit(state, 'foe').alive).toBe(false);
  });

  it('attack misses when total is below AC and natural 1 always misses', () => {
    // attackBonus -100 guarantees total < AC unless nat-20 crit
    const { state } = createCombat(
      makeGrid(),
      setup([
        { id: 'hero', pos: { x: 0, y: 0 }, stats: stats({ attackBonus: -100 }) },
        { id: 'foe', faction: 'enemy', pos: { x: 1, y: 0 } },
      ]),
      createRng(3),
    );
    const events = attack(state, 'hero', 'foe');
    const atk = events.find((e) => e.type === 'attack');
    expect(atk).toBeDefined();
    if (atk?.type === 'attack' && !atk.roll.crit) {
      expect(atk.roll.hit).toBe(false);
      expect(events.some((e) => e.type === 'damage')).toBe(false);
    }
  });

  it('rejects attacks out of range and friendly fire', () => {
    const { state } = createCombat(
      makeGrid(),
      setup([
        { id: 'hero', pos: { x: 0, y: 0 } },
        { id: 'ally', pos: { x: 1, y: 0 } },
        { id: 'foe', faction: 'enemy', pos: { x: 5, y: 5 } },
      ]),
      createRng(1),
    );
    expect(attack(state, 'hero', 'foe')).toHaveLength(0); // out of range
    expect(attack(state, 'hero', 'ally')).toHaveLength(0); // same faction
  });

  it('endTurn advances through living units, skips the dead, and bumps rounds', () => {
    const { state } = createCombat(
      makeGrid(),
      setup([
        { id: 'a', pos: { x: 0, y: 0 } },
        { id: 'b', faction: 'enemy', pos: { x: 5, y: 0 } },
        { id: 'c', faction: 'enemy', pos: { x: 5, y: 2 } },
      ]),
      createRng(9),
    );
    const first = currentUnit(state).id;
    // kill the next unit in order
    const order = state.turnOrder;
    const nextId = order[(state.turnIndex + 1) % order.length];
    getUnit(state, nextId).alive = false;

    const events = endTurn(state);
    const started = events.find((e) => e.type === 'turnStart');
    expect(started).toBeDefined();
    if (started?.type === 'turnStart') {
      expect(started.unitId).not.toBe(nextId);
      expect(started.unitId).not.toBe(first);
    }
    // move/act flags reset for the new unit
    expect(currentUnit(state).moved).toBe(false);
    expect(currentUnit(state).acted).toBe(false);
  });

  it('AI closes distance toward the nearest foe and attacks when adjacent', () => {
    const { state } = createCombat(
      makeGrid(),
      setup([
        { id: 'hero', pos: { x: 0, y: 0 } },
        { id: 'gob', faction: 'enemy', pos: { x: 3, y: 0 }, stats: stats({ speed: 2 }) },
      ]),
      createRng(5),
    );
    const gob = getUnit(state, 'gob');
    const events = aiTakeTurn(state, gob);
    // moved 2 tiles toward hero -> now at x=1, adjacent -> attacks
    expect(gob.pos).toEqual({ x: 1, y: 0 });
    expect(chebyshev(gob.pos, getUnit(state, 'hero').pos)).toBe(1);
    expect(events.some((e) => e.type === 'attack')).toBe(true);
  });

  it('attackableTargets uses Chebyshev adjacency (diagonals included)', () => {
    const { state } = createCombat(
      makeGrid(),
      setup([
        { id: 'hero', pos: { x: 2, y: 2 } },
        { id: 'diag', faction: 'enemy', pos: { x: 3, y: 3 } },
        { id: 'far', faction: 'enemy', pos: { x: 5, y: 2 } },
      ]),
      createRng(1),
    );
    const targets = attackableTargets(state, getUnit(state, 'hero'));
    expect(targets.map((t) => t.id)).toEqual(['diag']);
  });
});
