import type { DiceSpec, DiceResult } from './dice';
import type { Rng } from './rng';

export interface Vec2 {
  x: number;
  y: number;
}

export type Faction = 'party' | 'enemy';

export interface UnitStats {
  maxHp: number;
  ac: number;
  /** tiles of movement per turn */
  speed: number;
  attackBonus: number;
  damage: DiceSpec;
  /** melee = 1 (Chebyshev distance) */
  attackRange: number;
  initiativeBonus: number;
}

export interface Unit {
  id: string;
  name: string;
  faction: Faction;
  pos: Vec2;
  hp: number;
  stats: UnitStats;
  initiative: number;
  alive: boolean;
  /** turn economy: one move + one action per turn */
  moved: boolean;
  acted: boolean;
}

export interface GridSpec {
  width: number;
  height: number;
  /** tile keys ("x,y") that are impassable (walls, props) */
  blocked: Set<string>;
}

export interface CombatState {
  grid: GridSpec;
  units: Unit[];
  /** unit ids in initiative order */
  turnOrder: string[];
  turnIndex: number;
  round: number;
  over: boolean;
  victor: Faction | null;
  /** RNG used for attack/damage rolls after combat creation */
  rng: Rng;
}

export interface AttackRoll {
  d20: number;
  bonus: number;
  total: number;
  targetAc: number;
  hit: boolean;
  crit: boolean;
  fumble: boolean;
  damage: DiceResult | null;
}

export type CombatEvent =
  | { type: 'combatStart'; order: string[] }
  | { type: 'roundStart'; round: number }
  | { type: 'turnStart'; unitId: string }
  | { type: 'move'; unitId: string; path: Vec2[] }
  | { type: 'attack'; attackerId: string; targetId: string; roll: AttackRoll }
  | { type: 'damage'; targetId: string; amount: number; remainingHp: number }
  | { type: 'death'; unitId: string }
  | { type: 'combatEnd'; victor: Faction };
