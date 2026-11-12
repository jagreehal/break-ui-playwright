import type { Locator, Page } from '@playwright/test';

/**
 * Resolves when the animations running now have finished: on the whole page, or on one element and its children.
 * Pass an element on pages with an infinite animation, or it never resolves. Cancelled animations count as done.
 */
export const settle = (target: Page | Locator) =>
  'goto' in target
    ? target.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => {}))))
    : target.evaluate((el) => Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished.catch(() => {}))));

/** One row per animation running on the page: what the animation skills call the inventory (animation-performance Phase 1). */
export type Running = {
  target: string;
  kind: 'transition' | 'keyframes' | 'waapi';
  properties: string[];
  declared: string; // the element's transition-property, to catch `transition: all`
  duration: number;
  delay: number;
  easing: string;
  iterations: number | 'infinite';
  transforms: string[];
  origin: string;
  width: number;
};

/** Runs every CSS animation and transition at `rate` speed: the skills' "slow motion" debugging step, via CDP. */
export async function playbackRate(page: Page, rate: number) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Animation.enable');
  await cdp.send('Animation.setPlaybackRate', { playbackRate: rate });
  return cdp;
}

export function inventory(page: Page): Promise<Running[]> {
  return page.evaluate(() =>
    document.getAnimations().map((a) => {
      const effect = a.effect as KeyframeEffect;
      const el = effect.target as HTMLElement;
      const timing = effect.getComputedTiming();
      const frames = effect.getKeyframes();
      const kind = a instanceof CSSTransition ? 'transition' : a instanceof CSSAnimation ? 'keyframes' : 'waapi';
      const skip = new Set(['offset', 'computedOffset', 'easing', 'composite']);
      const s = getComputedStyle(el);
      return {
        target: `.${el.classList[0] ?? el.tagName.toLowerCase()}`,
        kind,
        properties: kind === 'transition' ? [(a as CSSTransition).transitionProperty] : [...new Set(frames.flatMap((f) => Object.keys(f).filter((k) => !skip.has(k))))],
        declared: s.transitionProperty,
        duration: Number(timing.duration),
        delay: timing.delay ?? 0,
        // CSS keyframes carry their timing function on each keyframe, transitions on the effect.
        easing: kind === 'keyframes' ? (frames[0]?.easing ?? 'linear') : (timing.easing ?? 'linear'),
        iterations: timing.iterations === Infinity ? 'infinite' : (timing.iterations ?? 1),
        transforms: frames.map((f) => String(f.transform ?? '')).filter(Boolean),
        origin: s.transformOrigin,
        width: el.getBoundingClientRect().width,
      };
    }),
  ) as Promise<Running[]>;
}

const LAYOUT = /^(width|height|top|left|right|bottom|margin.*|padding.*|border-width)$/;
const MOVES = (t: string) => t !== 'none' && !/^(translateY\(0px\)|scale\(1\)|matrix\(1, 0, 0, 1, 0, 0\))$/.test(t);

/**
 * The review-animations standards (skills/review-animations/SKILL.md, STANDARDS.md) that can be read off a running animation.
 * `limit` is the element's duration budget from the STANDARDS duration table.
 */
export function review(running: Running[], limit = 300) {
  const out: string[] = [];
  for (const r of running) {
    const name = `${r.target}`;
    if (r.kind === 'transition' && r.declared.split(', ').includes('all')) out.push(`transition-all ${name}`);
    if (r.transforms.some((t) => /scale\(0\)|matrix\(0, 0, 0, 0/.test(t))) out.push(`scale-0 ${name}`);
    if (/^ease-in$|^cubic-bezier\(0\.4, 0, 1, 1\)$/.test(r.easing)) out.push(`ease-in ${name}`);
    if (r.properties.some((p) => p === 'transform' || p === 'opacity') && /^(ease|ease-out|ease-in-out)$/.test(r.easing)) out.push(`weak-easing ${name}`);
    if (r.duration > limit) out.push(`too-slow ${name}`);
    if (r.properties.some((p) => LAYOUT.test(p))) out.push(`layout-property ${name}`);
    if (r.iterations === 'infinite') out.push(`infinite-loop ${name}`);
  }
  return [...new Set(out)];
}

export const moves = (running: Running[]) => running.filter((r) => r.transforms.some(MOVES) || (r.kind === 'transition' && r.properties.includes('transform')));

/** Every :hover rule that moves something without the `(hover: hover) and (pointer: fine)` gate. */
export function ungatedHover(page: Page) {
  return page.evaluate(() => {
    const found: string[] = [];
    const walk = (rules: CSSRuleList, gated: boolean) => {
      for (const rule of rules) {
        if (rule instanceof CSSMediaRule) walk(rule.cssRules, gated || /\(hover: ?hover\)/.test(rule.conditionText) && /\(pointer: ?fine\)/.test(rule.conditionText));
        else if (rule instanceof CSSStyleRule && rule.selectorText.includes(':hover') && rule.style.transform && !gated && document.querySelector(rule.selectorText.replaceAll(':hover', ''))) found.push(rule.selectorText);
      }
    };
    for (const sheet of document.styleSheets) walk(sheet.cssRules, false);
    return found;
  });
}

/** Number of layouts Chrome ran while `action` played out: what the performance skill means by "layout every frame". */
export async function layoutsDuring(page: Page, action: () => Promise<unknown>) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Performance.enable');
  const count = async () => (await cdp.send('Performance.getMetrics')).metrics.find((m) => m.name === 'LayoutCount')!.value;
  const start = await count();
  await action();
  await page.evaluate(() => Promise.all(document.getAnimations().filter((a) => a.effect?.getComputedTiming().iterations !== Infinity).map((a) => a.finished)));
  return (await count()) - start;
}
