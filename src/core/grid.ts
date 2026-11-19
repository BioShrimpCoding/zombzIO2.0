import type { CombatState, GridSpec, Unit, Vec2 } from './types';

export function tileKey(p: Vec2): string {
  return `${p.x},${p.y}`;
}

export function inBounds(grid: GridSpec, p: Vec2): boolean {
  return p.x >= 0 && p.y >= 0 && p.x < grid.width && p.y < grid.height;
}

/** Chebyshev distance — used for melee adjacency (diagonals count). */
export function chebyshev(a: Vec2, b: Vec2): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

const CARDINALS: Vec2[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];

export function occupiedKeys(state: CombatState, except?: string): Set<string> {
  const occ = new Set<string>();
  for (const u of state.units) {
    if (u.alive && u.id !== except) occ.add(tileKey(u.pos));
  }
  return occ;
}

/**
 * BFS flood fill up to the unit's speed (4-directional movement).
 * Returns a map of reachable tile key -> full path (excluding start, including dest).
 */
export function reachableTiles(state: CombatState, unit: Unit): Map<string, Vec2[]> {
  const result = new Map<string, Vec2[]>();
  const occ = occupiedKeys(state, unit.id);
  const visited = new Set<string>([tileKey(unit.pos)]);
  let frontier: { pos: Vec2; path: Vec2[] }[] = [{ pos: unit.pos, path: [] }];

  for (let step = 0; step < unit.stats.speed; step++) {
    const next: typeof frontier = [];
    for (const node of frontier) {
      for (const d of CARDINALS) {
        const p = { x: node.pos.x + d.x, y: node.pos.y + d.y };
        const k = tileKey(p);
        if (visited.has(k)) continue;
        if (!inBounds(state.grid, p) || state.grid.blocked.has(k) || occ.has(k)) continue;
        visited.add(k);
        const path = [...node.path, p];
        result.set(k, path);
        next.push({ pos: p, path });
      }
    }
    frontier = next;
  }
  return result;
}

/**
 * BFS shortest path from unit position to any tile within `range`
 * (Chebyshev) of the target. Used by AI. Returns the full path, [] if already
 * in range, or null if unreachable.
 */
export function pathToward(
  state: CombatState,
  unit: Unit,
  target: Vec2,
  range: number,
): Vec2[] | null {
  if (chebyshev(unit.pos, target) <= range) return [];
  const occ = occupiedKeys(state, unit.id);
  const visited = new Set<string>([tileKey(unit.pos)]);
  let frontier: { pos: Vec2; path: Vec2[] }[] = [{ pos: unit.pos, path: [] }];

  while (frontier.length > 0) {
    const next: typeof frontier = [];
    for (const node of frontier) {
      for (const d of CARDINALS) {
        const p = { x: node.pos.x + d.x, y: node.pos.y + d.y };
        const k = tileKey(p);
        if (visited.has(k)) continue;
        if (!inBounds(state.grid, p) || state.grid.blocked.has(k) || occ.has(k)) continue;
        visited.add(k);
        const path = [...node.path, p];
        if (chebyshev(p, target) <= range) return path;
        next.push({ pos: p, path });
      }
    }
    frontier = next;
  }
  return null;
}
