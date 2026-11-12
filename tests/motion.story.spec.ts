import { test, expect, type Page } from './lib/test';
import { story } from 'executable-stories-playwright';
import { inventory, layoutsDuring, settle, moves, playbackRate, review, ungatedHover, type Running } from './lib/motion';

story.feature({
  title: 'The animation skills: review, animate, choreograph, remove, find, improve, performance',
  narrative:
    'Each component on motion.html is checked against the rules in review-animations/STANDARDS.md, the same rules animate, emil-design-eng, ' +
    'choreograph, remove-animations, find-animation-opportunities, improve-animations and animation-performance apply. ' +
    'Playwright reads every running animation with document.getAnimations(), slows them with CDP (the skills\' "slow motion" step), ' +
    'pauses them for frame-by-frame screenshots, and counts layouts. Before the fixes the problems must be found; after, none.',
  tags: ['review-animations', 'animate', 'emil-design-eng', 'choreograph', 'remove-animations', 'find-animation-opportunities', 'improve-animations', 'animation-performance', 'apple-design'],
});

const SLOW = 0.05; // 20x slower, so the animations are still running when they are read.

async function open(page: Page, fixed: boolean, rate = SLOW) {
  await page.goto(`/motion.html${fixed ? '?fixed' : ''}`);
  await playbackRate(page, rate);
}
const on = (running: Running[], target: string) => running.filter((r) => r.target === target);
const table = (label: string, running: Running[]) =>
  story.table({
    label,
    columns: ['Element', 'Driver', 'Properties', 'Delay', 'Duration', 'Easing', 'Iterations', 'transform-origin'],
    rows: running.map((r) => [r.target, r.kind, r.properties.join(', '), `${r.delay}ms`, `${r.duration}ms`, r.easing, String(r.iterations), r.origin]),
  });
const findings = (label: string, found: string[]) => story.table({ label, columns: ['Finding', 'Element'], rows: found.map((f) => f.split(' ')) });

for (const fixed of [false, true]) {
  const version = fixed ? 'after the fixes' : 'before the fixes';
  const pair = fixed ? 'good (after the fixes)' : 'bad (before the fixes)';
  test(`press feedback and hover (standards 3, 7, 8): ${pair}`, async ({ page }, testInfo) => {
    story.init(testInfo);
    story.given(`the Save button, ${version}`);
    await open(page, fixed);
    const button = page.locator('.press');
    await button.hover();
    const hover = on(await inventory(page), '.press');
    story.when('it is hovered, then pressed');
    await playbackRate(page, 1);
    await page.mouse.down();
    await settle(button);
    const pressed = await button.evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).a);
    await story.screenshot({ page, alt: `Save pressed, ${version}`, fullPage: false });
    await page.mouse.up();
    const found = [...review(hover), ...(await ungatedHover(page)).filter((s) => s.includes('.press')).map((s) => `ungated-hover ${s}`), ...(pressed < 1 ? [] : ['no-press-feedback .press'])];
    table('Animations while hovered', hover);
    findings('Findings', found);
    if (fixed) {
      story.then('it scales to 0.97 on press, with no hover motion on touch');
      expect(found).toEqual([]);
      expect(pressed).toBeCloseTo(0.97);
    } else {
      story.then('`transition: all` with ease-in, an ungated hover scale, and nothing on press');
      expect(found).toEqual(expect.arrayContaining(['transition-all .press', 'ease-in .press', 'ungated-hover html:not(.fixed) .press:hover', 'no-press-feedback .press']));
    }
  });
}

for (const fixed of [false, true]) {
  const version = fixed ? 'after the fixes' : 'before the fixes';
  const pair = fixed ? 'good (after the fixes)' : 'bad (before the fixes)';
  test(`dropdown: easing, duration, origin, scale(0), frame by frame (standards 3, 4, 5): ${pair}`, async ({ page }, testInfo) => {
    story.init(testInfo);
    story.given(`the Sort by dropdown, ${version}`);
    await open(page, fixed);
    story.when('it opens, played 20x slower');
    await page.getByRole('button', { name: 'Sort by' }).click();
    const running = on(await inventory(page), '.popover');
    table('Animations on the popover', running);
    const fromTrigger = running.every((r) => parseFloat(r.origin) < 1);
    const found = [...review(running), ...(fromTrigger ? [] : ['origin-center .popover'])];
    findings('Findings', found);

    story.then('frame by frame (the skills\' frame-by-frame debugging step)');
    for (const at of [0, 0.25, 0.5, 0.75, 1]) {
      await page.evaluate((t) => document.getAnimations().forEach((a) => { a.pause(); a.currentTime = t * Number(a.effect!.getComputedTiming().duration); }), at);
      await story.screenshot({ page, alt: `${at * 100}% through, ${version}`, fullPage: false });
    }
    if (fixed) {
      expect(found).toEqual([]);
      expect(running.length).toBeGreaterThan(0);
    } else {
      story.then('it grows from nothing at the centre, slowly, with ease-in');
      expect(found).toEqual(expect.arrayContaining(['scale-0 .popover', 'ease-in .popover', 'too-slow .popover', 'origin-center .popover']));
    }
  });
}

for (const fixed of [false, true]) {
  const version = fixed ? 'after the fixes' : 'before the fixes';
  const pair = fixed ? 'good (after the fixes)' : 'bad (before the fixes)';
  test(`command palette on a keyboard shortcut does not animate (frequency rule): ${pair}`, async ({ page }, testInfo) => {
    story.init(testInfo);
    story.given(`the command palette, used hundreds of times a day, ${version}`);
    await open(page, fixed);
    story.when('Ctrl+K is pressed');
    await page.keyboard.press('Control+k');
    const running = on(await inventory(page), '.palette');
    table('Animations on the palette', running);
    await story.screenshot({ page, alt: `Palette opening, ${version}`, fullPage: false });
    story.then(fixed ? 'it appears instantly' : 'it animates, on an action repeated hundreds of times a day');
    expect(running.length > 0).toBe(!fixed);
  });
}

for (const fixed of [false, true]) {
  const version = fixed ? 'after the fixes' : 'before the fixes';
  const pair = fixed ? 'good (after the fixes)' : 'bad (before the fixes)';
  test(`toasts are interruptible: transitions, not keyframes (standard 6): ${pair}`, async ({ page }, testInfo) => {
    story.init(testInfo);
    story.given(`toasts, ${version}`);
    await open(page, fixed);
    story.when('three arrive in quick succession');
    for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Notify' }).click();
    const running = on(await inventory(page), '.toast');
    table('Animations on the toasts', running);
    await story.screenshot({ page, alt: `Toasts arriving, ${version}`, fullPage: false });
    const found = [...review(running), ...running.filter((r) => r.kind === 'keyframes').map(() => 'keyframes-not-interruptible .toast')];
    findings('Findings', [...new Set(found)]);
    if (fixed) {
      story.then('they enter with a transition that can be retargeted mid-flight');
      expect(found).toEqual([]);
      expect(running.every((r) => r.kind === 'transition')).toBe(true);
    } else {
      story.then('keyframes that restart from zero, ease-in, over 300ms');
      expect(found).toEqual(expect.arrayContaining(['keyframes-not-interruptible .toast', 'ease-in .toast', 'too-slow .toast']));
    }
  });
}

for (const fixed of [false, true]) {
  const version = fixed ? 'after the fixes' : 'before the fixes';
  const pair = fixed ? 'good (after the fixes)' : 'bad (before the fixes)';
  test(`upload bar: composite-only properties, layouts counted (animation-performance): ${pair}`, async ({ page }, testInfo) => {
    story.init(testInfo);
    story.given(`the upload progress bar, ${version}, at normal speed`);
    await open(page, fixed, 1);
    story.when('the upload completes and the bar fills');
    const layouts = await layoutsDuring(page, async () => {
      await page.getByRole('button', { name: 'Upload' }).click();
      await page.waitForTimeout(20); // long enough for the bar to start filling while layouts are counted
    });
    await story.screenshot({ page, alt: `Upload done, ${version}`, fullPage: false });
    await page.reload();
    await playbackRate(page, SLOW);
    await page.getByRole('button', { name: 'Upload' }).click();
    const running = on(await inventory(page), '.bar-fill');
    table('Animations on the bar', running);
    story.kv({ label: 'Layouts while it filled', value: layouts });
    if (fixed) {
      story.then('it animates transform, and the browser barely lays out at all');
      expect(review(running)).toEqual([]);
      expect(layouts).toBeLessThanOrEqual(3);
    } else {
      story.then('it animates width, so the browser lays out the page on every frame');
      expect(review(running)).toContain('layout-property .bar-fill');
      expect(layouts).toBeGreaterThan(5);
    }
  });
}

for (const fixed of [false, true]) {
  const version = fixed ? 'after the fixes' : 'before the fixes';
  const pair = fixed ? 'good (after the fixes)' : 'bad (before the fixes)';
  test(`search results: stagger and roles (choreograph, remove-animations): ${pair}`, async ({ page }, testInfo) => {
    story.init(testInfo);
    story.given(`five search results and a "New" pill, ${version}`);
    await open(page, fixed);
    story.when('they load');
    await page.getByRole('button', { name: 'Load results' }).click();
    const all = await inventory(page);
    const results = on(all, '.result');
    const pill = on(all, '.pill');
    table('Part 1: timeline', [...results, ...pill]);
    await page.waitForTimeout(400); // mid-entrance on purpose, so the screenshot shows the stagger
    await story.screenshot({ page, alt: `Results entering, ${version}`, fullPage: false });
    const gaps = results.slice(1).map((r, i) => Math.round(r.delay - results[i]!.delay));
    const found = [
      ...review([...results, ...pill]),
      ...(gaps.every((g) => g === 0) ? ['everything-at-once .result'] : []),
      ...(gaps.some((g) => g > 80) ? ['stagger-too-slow .result'] : []),
      ...(moves(pill).length ? ['decoration-moves .pill'] : []),
    ];
    findings('Findings', found);
    if (fixed) {
      story.then('a 50ms stagger, 250ms each, and the decoration only fades');
      expect(found).toEqual([]);
      expect(gaps).toEqual([50, 50, 50, 50]);
    } else {
      story.then('all five at once, 600ms each, and the pill moves with them');
      expect(found).toEqual(expect.arrayContaining(['everything-at-once .result', 'too-slow .result', 'decoration-moves .pill']));
    }
  });
}

for (const fixed of [false, true]) {
  const version = fixed ? 'after the fixes' : 'before the fixes';
  const pair = fixed ? 'good (after the fixes)' : 'bad (before the fixes)';
  test(`live badge: no infinite loop on a persistent element (remove-animations): ${pair}`, async ({ page }, testInfo) => {
    story.init(testInfo);
    story.given(`the Live status dot, ${version}`);
    await open(page, fixed, 1);
    const running = on(await inventory(page), '.live');
    table('Animations on the dot', running);
    await story.screenshot({ page, alt: `Live dot, ${version}`, fullPage: false });
    story.then(fixed ? 'it is still, and still visible (the removal hazard check)' : 'it pulses forever');
    expect(review(running).includes('infinite-loop .live')).toBe(!fixed);
    await expect(page.locator('.live')).toBeVisible();
    if (fixed) expect(await page.locator('.live').evaluate((el) => getComputedStyle(el).opacity)).toBe('1');
  });
}

for (const fixed of [false, true]) {
  const version = fixed ? 'after the fixes' : 'before the fixes';
  const pair = fixed ? 'good (after the fixes)' : 'bad (before the fixes)';
  test(`hold to delete: slow press, fast release (standard 9): ${pair}`, async ({ page }, testInfo) => {
    story.init(testInfo);
    story.given(`the Hold to delete button, ${version}`);
    await open(page, fixed);
    story.when('it is held until full, then released');
    await page.locator('.hold').hover();
    await page.mouse.down();
    const press = on(await inventory(page), '.hold-fill');
    await story.screenshot({ page, alt: `Holding, ${version}`, fullPage: false });
    // Let the press finish at full speed: releasing mid-way would shorten the reverse transition, which is the interruptibility working.
    await playbackRate(page, 1);
    await page.evaluate(() => Promise.all(document.getAnimations().filter((a) => a.effect?.getComputedTiming().iterations !== Infinity).map((a) => a.finished)));
    await playbackRate(page, SLOW);
    await page.mouse.up();
    const release = on(await inventory(page), '.hold-fill');
    table('Press', press);
    table('Release', release);
    const [p, r] = [press[0]!.duration, release[0]!.duration];
    if (fixed) {
      story.then('the press fills over 2s, linear; the release snaps back in 200ms');
      expect([p, r]).toEqual([2000, 200]);
    } else {
      story.then('press and release take the same time');
      expect(p).toBe(r);
    }
  });
}

for (const fixed of [false, true]) {
  const version = fixed ? 'after the fixes' : 'before the fixes';
  const pair = fixed ? 'good (after the fixes)' : 'bad (before the fixes)';
  test(`settings modal: motion where it belongs (find-animation-opportunities): ${pair}`, async ({ page }, testInfo) => {
    story.init(testInfo);
    story.given(`the Settings modal, opened occasionally, ${version}`);
    await open(page, fixed);
    story.when('it opens');
    await page.getByRole('button', { name: 'Open settings' }).click();
    const running = on(await inventory(page), '.modal');
    table('Animations on the modal', running);
    await story.screenshot({ page, alt: `Settings opening, ${version}`, fullPage: false });
    if (fixed) {
      story.then('it scales in from 0.95 over 200ms with a strong ease-out, from the centre (modals are exempt from the origin rule)');
      expect(running.length).toBeGreaterThan(0);
      expect(review(running, 500)).toEqual([]);
    } else {
      story.then('it appears with no transition: an opportunity (occasional, prevents a jarring change)');
      expect(running).toEqual([]);
    }
  });
}

for (const fixed of [false, true]) {
  const version = fixed ? 'after the fixes' : 'before the fixes';
  const pair = fixed ? 'good (after the fixes)' : 'bad (before the fixes)';
  test(`project card hover: reduced to a colour change (remove-animations): ${pair}`, async ({ page }, testInfo) => {
    story.init(testInfo);
    story.given(`a project card hovered tens of times a day, ${version}`);
    await open(page, fixed);
    await page.locator('.card-link').hover();
    const running = on(await inventory(page), '.card-link');
    table('Animations on hover', running);
    await story.screenshot({ page, alt: `Card hovered, ${version}`, fullPage: false });
    if (fixed) {
      story.then('only the border colour changes, 150ms');
      expect(moves(running)).toEqual([]);
      expect(running.map((r) => r.properties[0]).sort()).toEqual(['border-bottom-color', 'border-left-color', 'border-right-color', 'border-top-color']);
    } else {
      story.then('it lifts and scales with `transition: all`');
      expect(moves(running).length).toBeGreaterThan(0);
      expect(review(running)).toContain('transition-all .card-link');
    }
  });
}

for (const fixed of [false, true]) {
  const version = fixed ? 'after the fixes' : 'before the fixes';
  const pair = fixed ? 'good (after the fixes)' : 'bad (before the fixes)';
  test(`reduced motion: gentler, not zero (standard 8, apple-design): ${pair}`, async ({ page }, testInfo) => {
    story.init(testInfo);
    story.given(`the user prefers reduced motion, ${version}`);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page, fixed);
    story.when('the dropdown, a toast, the modal and the results all enter');
    await page.getByRole('button', { name: 'Sort by' }).click();
    await page.getByRole('button', { name: 'Notify' }).click();
    await page.getByRole('button', { name: 'Load results' }).click();
    await page.getByRole('button', { name: 'Open settings' }).click();
    const running = (await inventory(page)).filter((r) => r.target !== '.live');
    table('Animations under reduced motion', running);
    await story.screenshot({ page, alt: `Reduced motion, ${version}`, fullPage: false });
    if (fixed) {
      story.then('nothing moves, but things still fade in');
      expect(moves(running)).toEqual([]);
      expect(running.some((r) => r.properties.includes('opacity'))).toBe(true);
    } else {
      story.then('everything still slides and scales');
      expect(moves(running).length).toBeGreaterThan(0);
    }
  });
}

test('improve-animations / animation-performance: the whole-page inventory, before and after', async ({ page }, testInfo) => {
  story.init(testInfo);
  const counts: number[] = [];
  for (const fixed of [false, true]) {
    const version = fixed ? 'after the fixes' : 'before the fixes';
    const pair = fixed ? 'good (after the fixes)' : 'bad (before the fixes)';
    story.given(`every interaction on motion.html, ${version}`);
    await open(page, fixed);
    await page.locator('.press').hover();
    for (const name of ['Sort by', 'Notify', 'Upload', 'Load results', 'Open settings']) await page.getByRole('button', { name }).click();
    await page.keyboard.press('Control+k');
    const running = await inventory(page);
    await story.screenshot({ page, alt: `Everything triggered, ${version}` });
    table(`Everything animating, ${version}`, running);
    const found = review(running.filter((r) => r.target !== '.modal'));
    findings(`Phase 3 findings, ${version}`, found);
    counts.push(found.length);
  }
  story.then('the audit finds problems before the fixes and none after');
  expect(counts[0]).toBeGreaterThan(10);
  expect(counts[1]).toBe(0);
});
