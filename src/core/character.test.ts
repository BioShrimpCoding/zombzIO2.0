import { describe, expect, it } from 'vitest';
import {
  STANDARD_ARRAY,
  abilityMod,
  createHeroSetup,
  deriveStats,
  getClass,
  recommendedScores,
} from './character';

describe('character creation', () => {
  it('computes D&D ability modifiers', () => {
    expect(abilityMod(8)).toBe(-1);
    expect(abilityMod(10)).toBe(0);
    expect(abilityMod(15)).toBe(2);
    expect(abilityMod(20)).toBe(5);
  });

  it('recommended scores are a permutation of the standard array', () => {
    for (const id of ['fighter', 'rogue', 'cleric', 'wizard'] as const) {
      const scores = recommendedScores(getClass(id));
      const values = Object.values(scores).sort((a, b) => b - a);
      expect(values).toEqual([...STANDARD_ARRAY].sort((a, b) => b - a));
    }
  });

  it('derives fighter stats: STR attack, heavy armor ignores dex', () => {
    const fighter = getClass('fighter');
    const s = deriveStats(fighter, recommendedScores(fighter));
    // STR 15 (+2): attack = prof 2 + 2, damage 1d8+2, HP = 10 + con 14 (+2)
    expect(s.attackBonus).toBe(4);
    expect(s.damage).toEqual({ count: 1, sides: 8, bonus: 2 });
    expect(s.maxHp).toBe(12);
    expect(s.ac).toBe(16);
  });

  it('derives wizard stats: INT attack, ranged, unarmored AC uses dex', () => {
    const wizard = getClass('wizard');
    const s = deriveStats(wizard, recommendedScores(wizard));
    // INT 15 (+2), DEX 14 (+2), CON 13 (+1)
    expect(s.attackBonus).toBe(4);
    expect(s.attackRange).toBe(4);
    expect(s.ac).toBe(12);
    expect(s.maxHp).toBe(7);
    expect(s.initiativeBonus).toBe(2);
  });

  it('createHeroSetup falls back to the class default name when blank', () => {
    const scores = recommendedScores(getClass('rogue'));
    const hero = createHeroSetup('   ', 'rogue', scores, { x: 1, y: 1 });
    expect(hero.name).toBe('Vex');
    expect(hero.faction).toBe('party');
    expect(hero.id).toBe('hero');
  });
});
