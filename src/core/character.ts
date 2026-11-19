import type { UnitSetup } from './combat';
import type { DiceSpec } from './dice';
import type { Vec2 } from './types';

export type AbilityId = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha';

export const ABILITIES: { id: AbilityId; name: string }[] = [
  { id: 'str', name: 'Strength' },
  { id: 'dex', name: 'Dexterity' },
  { id: 'con', name: 'Constitution' },
  { id: 'int', name: 'Intelligence' },
  { id: 'wis', name: 'Wisdom' },
  { id: 'cha', name: 'Charisma' },
];

export type AbilityScores = Record<AbilityId, number>;

/** Classic D&D standard array, assigned by the player at creation. */
export const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];

export function abilityMod(score: number): number {
  return Math.floor((score - 10) / 2);
}

export const PROFICIENCY = 2;

export type ClassId = 'fighter' | 'rogue' | 'cleric' | 'wizard';

export interface ClassDef {
  id: ClassId;
  name: string;
  blurb: string;
  hitDie: number;
  speed: number;
  weapon: {
    name: string;
    dice: Omit<DiceSpec, 'bonus'>;
    range: number;
    /** ability used for attack and damage rolls */
    ability: AbilityId;
  };
  /** armor class from class equipment + dex */
  armorClass: (dexMod: number) => number;
  armorName: string;
  /** default standard-array assignment, best score first */
  recommended: AbilityId[];
  defaultName: string;
}

export const CLASSES: ClassDef[] = [
  {
    id: 'fighter',
    name: 'Fighter',
    blurb: 'Front-line bruiser. Heavy armor, longsword, hard to kill.',
    hitDie: 10,
    speed: 4,
    weapon: { name: 'Longsword', dice: { count: 1, sides: 8 }, range: 1, ability: 'str' },
    armorClass: () => 16, // chain mail + shield (no dex)
    armorName: 'Chain mail & shield',
    recommended: ['str', 'con', 'dex', 'wis', 'cha', 'int'],
    defaultName: 'Brakka',
  },
  {
    id: 'rogue',
    name: 'Rogue',
    blurb: 'Fast and slippery. Strikes with finesse, extra movement.',
    hitDie: 8,
    speed: 5,
    weapon: { name: 'Shortsword', dice: { count: 1, sides: 6 }, range: 1, ability: 'dex' },
    armorClass: (dex) => 11 + dex, // leather armor
    armorName: 'Leather armor',
    recommended: ['dex', 'con', 'wis', 'cha', 'int', 'str'],
    defaultName: 'Vex',
  },
  {
    id: 'cleric',
    name: 'Cleric',
    blurb: 'Armored zealot. Solid in melee — healing prayers coming soon.',
    hitDie: 8,
    speed: 4,
    weapon: { name: 'Mace', dice: { count: 1, sides: 6 }, range: 1, ability: 'str' },
    armorClass: (dex) => 14 + Math.min(2, Math.max(0, dex)), // scale mail
    armorName: 'Scale mail',
    recommended: ['wis', 'str', 'con', 'cha', 'dex', 'int'],
    defaultName: 'Osric',
  },
  {
    id: 'wizard',
    name: 'Wizard',
    blurb: 'Fragile artillery. Hurls fire bolts from 4 tiles away.',
    hitDie: 6,
    speed: 4,
    weapon: { name: 'Fire Bolt', dice: { count: 1, sides: 10 }, range: 4, ability: 'int' },
    armorClass: (dex) => 10 + dex, // unarmored
    armorName: 'Robes',
    recommended: ['int', 'dex', 'con', 'wis', 'cha', 'str'],
    defaultName: 'Mirelle',
  },
];

export function getClass(id: ClassId): ClassDef {
  const c = CLASSES.find((c) => c.id === id);
  if (!c) throw new Error(`Unknown class: ${id}`);
  return c;
}

/** Default standard-array assignment for a class (recommended order). */
export function recommendedScores(cls: ClassDef): AbilityScores {
  const scores = {} as AbilityScores;
  cls.recommended.forEach((ability, i) => {
    scores[ability] = STANDARD_ARRAY[i];
  });
  return scores;
}

export interface DerivedStats {
  maxHp: number;
  ac: number;
  speed: number;
  attackBonus: number;
  damage: DiceSpec;
  attackRange: number;
  initiativeBonus: number;
}

/** Derive level-1 combat stats from class + ability scores. */
export function deriveStats(cls: ClassDef, scores: AbilityScores): DerivedStats {
  const dexMod = abilityMod(scores.dex);
  const atkMod = abilityMod(scores[cls.weapon.ability]);
  return {
    maxHp: cls.hitDie + abilityMod(scores.con),
    ac: cls.armorClass(dexMod),
    speed: cls.speed,
    attackBonus: PROFICIENCY + atkMod,
    damage: { ...cls.weapon.dice, bonus: atkMod },
    attackRange: cls.weapon.range,
    initiativeBonus: dexMod,
  };
}

export function createHeroSetup(
  name: string,
  classId: ClassId,
  scores: AbilityScores,
  pos: Vec2,
): UnitSetup {
  const cls = getClass(classId);
  return {
    id: 'hero',
    name: name.trim() || cls.defaultName,
    faction: 'party',
    pos,
    stats: deriveStats(cls, scores),
  };
}
