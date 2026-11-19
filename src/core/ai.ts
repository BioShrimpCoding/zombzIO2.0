import { attack, moveUnit } from './combat';
import { chebyshev, pathToward, reachableTiles, tileKey } from './grid';
import type { CombatEvent, CombatState, Unit } from './types';

/**
 * Simple enemy AI:
 * 1. Pick target: lowest-HP living party member in attack range,
 *    otherwise the nearest party member.
 * 2. If not in range, move along the shortest path (up to speed).
 * 3. Attack if in range after moving.
 */
export function aiTakeTurn(state: CombatState, unit: Unit): CombatEvent[] {
  if (state.over || !unit.alive) return [];
  const events: CombatEvent[] = [];
  const foes = state.units.filter((u) => u.faction !== unit.faction && u.alive);
  if (foes.length === 0) return events;

  const inRange = foes.filter(
    (f) => chebyshev(unit.pos, f.pos) <= unit.stats.attackRange,
  );

  let target: Unit;
  if (inRange.length > 0) {
    target = inRange.reduce((a, b) => (b.hp < a.hp ? b : a));
  } else {
    target = foes.reduce((a, b) =>
      chebyshev(unit.pos, b.pos) < chebyshev(unit.pos, a.pos) ? b : a,
    );
    const path = pathToward(state, unit, target.pos, unit.stats.attackRange);
    if (path && path.length > 0) {
      // Walk as far along the path as movement allows, using only
      // tiles actually reachable this turn.
      const reach = reachableTiles(state, unit);
      let dest = null;
      for (let i = Math.min(path.length, unit.stats.speed) - 1; i >= 0; i--) {
        if (reach.has(tileKey(path[i]))) {
          dest = path[i];
          break;
        }
      }
      if (dest) events.push(...moveUnit(state, unit.id, dest));
    }
  }

  if (chebyshev(unit.pos, target.pos) <= unit.stats.attackRange) {
    events.push(...attack(state, unit.id, target.id));
  }
  return events;
}
