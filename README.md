# The Last Party

A turn-based tactics roguelite in isometric 3D. Guide a party of heroes through
procedurally generated dungeon floors — heroes die permanently, recruits mutate
your party, and every run tells a different story.

Built with TypeScript, Vite, and Three.js. The combat rules engine
(`src/core/`) is fully headless and tested independently of rendering.

## Run it

```bash
npm install
npm run dev     # dev server at http://localhost:5173
```

## Other commands

```bash
npm test        # run the rules-engine tests (vitest)
npm run build   # typecheck + production build to dist/
```

## Current status — Milestone 1: combat vertical slice + character creation

- **Character creation**: name your hero, pick a class (Fighter / Rogue / Cleric / Wizard),
  and assign the D&D standard array to your six ability scores — stats like HP, AC,
  attack and damage are derived from them
- Isometric 3D arena with tiles, pillars, lighting and shadows
- Your hero vs two AI goblins — you control your character, only enemies are AI
- d20 initiative, to-hit rolls vs AC, damage dice, crits (nat 20) and fumbles (nat 1)
- Move (green tiles) + attack (red tiles), one of each per turn — Wizard attacks from range
- Combat log, HP bars, floating damage numbers, victory/defeat

### How to play

- **Create your hero**, then click **Begin Adventure**
- **Click a green tile** to move (once per turn)
- **Click a red-highlighted enemy** to attack (once per turn)
- **End Turn** passes to the next combatant

> **Codespaces note:** open the forwarded port 5173 from the Ports tab; the dev
> server is configured to accept forwarded hosts.

## Roadmap

- [x] M0 — Scaffold: Vite + TS + Three.js, iso camera, clickable grid
- [x] M1 — Combat vertical slice: move/attack, d20 rolls, HP, death
- [x] M1.5 — Character creation: name, class, ability scores
- [ ] M2 — Party & classes: 3 heroes, class abilities, initiative tracker
- [ ] M3 — Dungeon run: node map, room generation, loot, camp with recruiting
- [ ] M4 — Roguelite layer: floors, boss, meta-unlocks, run log, saves
- [ ] M5 — Juice: physics dice, animations, sound, quirks
