import type { Rng } from './rng';

/** e.g. { count: 1, sides: 8, bonus: 3 } = 1d8+3 */
export interface DiceSpec {
  count: number;
  sides: number;
  bonus: number;
}

export interface DiceResult {
  rolls: number[];
  bonus: number;
  total: number;
}

export function rollDie(rng: Rng, sides: number): number {
  return 1 + Math.floor(rng() * sides);
}

export function rollDice(rng: Rng, spec: DiceSpec): DiceResult {
  const rolls: number[] = [];
  for (let i = 0; i < spec.count; i++) rolls.push(rollDie(rng, spec.sides));
  const total = rolls.reduce((a, b) => a + b, 0) + spec.bonus;
  return { rolls, bonus: spec.bonus, total };
}

export function formatDice(spec: DiceSpec): string {
  const base = `${spec.count}d${spec.sides}`;
  if (spec.bonus > 0) return `${base}+${spec.bonus}`;
  if (spec.bonus < 0) return `${base}${spec.bonus}`;
  return base;
}
