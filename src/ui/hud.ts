import type { CombatState, Unit } from '../core/types';

export interface Hud {
  log(html: string): void;
  setTurn(state: CombatState, unit: Unit): void;
  setHint(text: string): void;
  onEndTurn(cb: () => void): void;
  setEndTurnEnabled(enabled: boolean): void;
  showBanner(text: string, cls: string): void;
}

export function createHud(root: HTMLElement): Hud {
  root.innerHTML = `
    <div id="turn-indicator"></div>
    <div id="hint"></div>
    <div id="log-panel"><div id="log"></div></div>
    <div id="action-bar">
      <button id="end-turn">End Turn</button>
    </div>
    <div id="banner" class="hidden"></div>
  `;

  const logEl = root.querySelector<HTMLElement>('#log')!;
  const turnEl = root.querySelector<HTMLElement>('#turn-indicator')!;
  const hintEl = root.querySelector<HTMLElement>('#hint')!;
  const endTurnBtn = root.querySelector<HTMLButtonElement>('#end-turn')!;
  const bannerEl = root.querySelector<HTMLElement>('#banner')!;

  return {
    log(html: string) {
      const line = document.createElement('div');
      line.className = 'log-line';
      line.innerHTML = html;
      logEl.appendChild(line);
      logEl.parentElement!.scrollTop = logEl.parentElement!.scrollHeight;
    },
    setTurn(state: CombatState, unit: Unit) {
      const who = unit.faction === 'party' ? 'Your turn' : 'Enemy turn';
      turnEl.innerHTML = `<span class="round">Round ${state.round}</span> — <span class="${unit.faction}">${who}: ${unit.name}</span>`;
    },
    setHint(text: string) {
      hintEl.textContent = text;
    },
    onEndTurn(cb: () => void) {
      endTurnBtn.addEventListener('click', cb);
    },
    setEndTurnEnabled(enabled: boolean) {
      endTurnBtn.disabled = !enabled;
    },
    showBanner(text: string, cls: string) {
      bannerEl.textContent = text;
      bannerEl.className = cls;
    },
  };
}
