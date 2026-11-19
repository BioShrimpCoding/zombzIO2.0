/** Minimal promise-based tween driver, ticked from the render loop. */

type TweenFn = (t: number) => void;

interface ActiveTween {
  fn: TweenFn;
  start: number;
  duration: number;
  resolve: () => void;
}

const active: ActiveTween[] = [];

export function tween(duration: number, fn: TweenFn): Promise<void> {
  return new Promise((resolve) => {
    active.push({ fn, start: performance.now(), duration, resolve });
  });
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function updateTweens(now: number): void {
  for (let i = active.length - 1; i >= 0; i--) {
    const tw = active[i];
    const t = Math.min(1, (now - tw.start) / tw.duration);
    tw.fn(t);
    if (t >= 1) {
      active.splice(i, 1);
      tw.resolve();
    }
  }
}
