import {
  ABILITIES,
  CLASSES,
  STANDARD_ARRAY,
  abilityMod,
  deriveStats,
  getClass,
  recommendedScores,
  type AbilityId,
  type AbilityScores,
  type ClassId,
} from '../core/character';
import { formatDice } from '../core/dice';

export interface CreationResult {
  name: string;
  classId: ClassId;
  scores: AbilityScores;
}

/**
 * Character creation screen (DOM overlay). Pick a name, a class, and assign
 * the standard array to abilities. Resolves when the player clicks Begin.
 */
export function showCharacterCreator(root: HTMLElement): Promise<CreationResult> {
  return new Promise((resolve) => {
    let classId: ClassId = 'fighter';
    let scores: AbilityScores = recommendedScores(getClass(classId));

    root.innerHTML = `
      <div id="creator">
        <div class="creator-panel">
          <h1>Create Your Hero</h1>

          <label class="field-label" for="hero-name">Name</label>
          <input id="hero-name" type="text" maxlength="24" spellcheck="false" />

          <div class="field-label">Class</div>
          <div class="class-grid">
            ${CLASSES.map(
              (c) => `
              <button class="class-card" data-class="${c.id}">
                <span class="class-name">${c.name}</span>
                <span class="class-blurb">${c.blurb}</span>
              </button>`,
            ).join('')}
          </div>

          <div class="field-label">
            Abilities <span class="sub">(assign the standard array — swap values between stats)</span>
          </div>
          <div class="ability-grid">
            ${ABILITIES.map(
              (a) => `
              <div class="ability-row">
                <label for="ab-${a.id}">${a.name}</label>
                <select id="ab-${a.id}" data-ability="${a.id}">
                  ${STANDARD_ARRAY.map((v) => `<option value="${v}">${v}</option>`).join('')}
                </select>
                <span class="ability-mod" id="mod-${a.id}"></span>
              </div>`,
            ).join('')}
          </div>

          <div class="field-label">Summary</div>
          <div id="stat-preview"></div>

          <button id="begin-btn">⚔️ Begin Adventure</button>
        </div>
      </div>
    `;

    const nameInput = root.querySelector<HTMLInputElement>('#hero-name')!;
    const classCards = [...root.querySelectorAll<HTMLButtonElement>('.class-card')];
    const selects = [...root.querySelectorAll<HTMLSelectElement>('select[data-ability]')];
    const preview = root.querySelector<HTMLElement>('#stat-preview')!;
    const beginBtn = root.querySelector<HTMLButtonElement>('#begin-btn')!;

    let nameTouched = false;
    nameInput.value = getClass(classId).defaultName;
    nameInput.addEventListener('input', () => (nameTouched = true));

    function syncUi() {
      for (const card of classCards) {
        card.classList.toggle('selected', card.dataset.class === classId);
      }
      for (const sel of selects) {
        const id = sel.dataset.ability as AbilityId;
        sel.value = String(scores[id]);
        const mod = abilityMod(scores[id]);
        root.querySelector(`#mod-${id}`)!.textContent = mod >= 0 ? `+${mod}` : `${mod}`;
      }
      const cls = getClass(classId);
      const s = deriveStats(cls, scores);
      const atk = s.attackBonus >= 0 ? `+${s.attackBonus}` : `${s.attackBonus}`;
      preview.innerHTML = `
        <span>❤️ HP <b>${s.maxHp}</b></span>
        <span>🛡️ AC <b>${s.ac}</b> <i>(${cls.armorName})</i></span>
        <span>👟 Speed <b>${s.speed}</b></span>
        <span>🗡️ ${cls.weapon.name} <b>${atk}</b> to hit, <b>${formatDice(s.damage)}</b> dmg${
          s.attackRange > 1 ? `, range ${s.attackRange}` : ''
        }</span>
      `;
    }

    for (const card of classCards) {
      card.addEventListener('click', () => {
        classId = card.dataset.class as ClassId;
        scores = recommendedScores(getClass(classId));
        if (!nameTouched) nameInput.value = getClass(classId).defaultName;
        syncUi();
      });
    }

    // Standard array must stay a permutation: picking a value already used
    // elsewhere swaps the two abilities.
    for (const sel of selects) {
      sel.addEventListener('change', () => {
        const id = sel.dataset.ability as AbilityId;
        const newVal = Number(sel.value);
        const oldVal = scores[id];
        const other = (Object.keys(scores) as AbilityId[]).find(
          (k) => k !== id && scores[k] === newVal,
        );
        if (other) scores[other] = oldVal;
        scores[id] = newVal;
        syncUi();
      });
    }

    beginBtn.addEventListener('click', () => {
      const result: CreationResult = {
        name: nameInput.value.trim() || getClass(classId).defaultName,
        classId,
        scores: { ...scores },
      };
      root.innerHTML = '';
      resolve(result);
    });

    syncUi();
  });
}
