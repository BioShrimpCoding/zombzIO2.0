import type { UnitSetup } from '../core/combat';
import type { GridSpec } from '../core/types';
import { tileKey } from '../core/grid';

/** Milestone 1 vertical slice: your created hero vs two goblins in a small room. */

export const HERO_START = { x: 1, y: 4 };

export function createArena(): GridSpec {
  const blocked = new Set<string>();
  // a few pillars/crates for tactical flavor
  for (const p of [
    { x: 3, y: 3 },
    { x: 6, y: 2 },
    { x: 5, y: 5 },
    { x: 2, y: 6 },
  ]) {
    blocked.add(tileKey(p));
  }
  return { width: 9, height: 8, blocked };
}

export function createEnemies(): UnitSetup[] {
  return [
    {
      id: 'goblin-a',
      name: 'Goblin Stabber',
      faction: 'enemy',
      pos: { x: 7, y: 2 },
      stats: {
        maxHp: 7,
        ac: 13,
        speed: 4,
        attackBonus: 4,
        damage: { count: 1, sides: 6, bonus: 2 }, // rusty dagger 1d6+2
        attackRange: 1,
        initiativeBonus: 2,
      },
    },
    {
      id: 'goblin-b',
      name: 'Goblin Biter',
      faction: 'enemy',
      pos: { x: 7, y: 6 },
      stats: {
        maxHp: 7,
        ac: 13,
        speed: 4,
        attackBonus: 4,
        damage: { count: 1, sides: 6, bonus: 2 },
        attackRange: 1,
        initiativeBonus: 2,
      },
    },
  ];
}
