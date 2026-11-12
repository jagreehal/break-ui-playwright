import { test, expect, type Page } from './lib/test';
import { story } from 'executable-stories-playwright';
import { inventory, playbackRate, settle } from './lib/motion';

story.feature({
  title: 'gestures and apple-design: a drag-to-dismiss sheet',
  narrative:
    'skills/gestures and skills/apple-design checked with real pointer events from page.mouse, and two-finger touch through CDP. ' +
    'Tracking, rubber-banding, distance-or-velocity release, snap-back speed, interruption, hit target, touch-action, press feedback, multi-touch and reduced motion.',
  tags: ['gestures', 'apple-design'],
});

test.use({ viewport: { width: 390, height: 844 } });

const sheetY = (page: Page) => page.locator('.sheet').evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).m42);

async function openSheet(page: Page, fixed: boolean) {
  await page.goto(`/sheet.html${fixed ? '?fixed' : ''}`);
  await page.getByRole('button', { name: 'Open sheet' }).click();
  await settle(page);
  const box = (await page.locator('.handle').boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

for (const fixed of [false, true]) {
  const version = fixed ? 'after the fixes' : 'before the fixes';
  const pair = fixed ? 'good (after the fixes)' : 'bad (before the fixes)';
  test(`the sheet tracks the pointer 1:1, moved by its own transform: ${pair}`, async ({ page }, testInfo) => {
    story.init(testInfo);
    story.given(`an open sheet, ${version}`);
    const h = await openSheet(page, fixed);
    story.when('the handle is dragged down 120px');
    await page.mouse.move(h.x, h.y);
    await page.mouse.down();
    await page.mouse.move(h.x, h.y + 120, { steps: 6 });
    const y = await sheetY(page);
    const viaVariable = await page.evaluate(() => document.documentElement.style.getPropertyValue('--drag') !== '');
    await story.screenshot({ page, alt: `Mid-drag, ${version}`, fullPage: false });
    await page.mouse.up();
    story.kv({ label: 'Sheet moved (px) for a 120px drag', value: Math.round(y) });
    if (fixed) {
      story.then('it sits exactly under the finger, written straight to the sheet');
      expect(y).toBeCloseTo(120, 0);
      expect(viaVariable).toBe(false);
    } else {
      story.then('it trails behind through a 600ms transition, driven by a CSS variable on the root');
      expect(y).toBeLessThan(100);
      expect(viaVariable).toBe(true);
    }
  });
}

for (const fixed of [false, true]) {
  const version = fixed ? 'after the fixes' : 'before the fixes';
  const pair = fixed ? 'good (after the fixes)' : 'bad (before the fixes)';
  test(`dragging past the top rubber-bands instead of stopping dead: ${pair}`, async ({ page }, testInfo) => {
    story.init(testInfo);
    story.given(`an open sheet, ${version}`);
    const h = await openSheet(page, fixed);
    story.when('the handle is dragged 100px up, past its resting point');
    await page.mouse.move(h.x, h.y);
    await page.mouse.down();
    await page.mouse.move(h.x, h.y - 100, { steps: 6 });
    const y = await sheetY(page);
    await story.screenshot({ page, alt: `Over-dragged, ${version}`, fullPage: false });
    await page.mouse.up();
    story.kv({ label: 'Sheet moved (px) for a 100px over-drag', value: Math.round(y) });
    story.then(fixed ? 'it gives a little, about a fifth of the distance' : 'it does not move at all: a wall');
    if (fixed) expect(y).toBeCloseTo(-20, 0);
    else expect(y).toBe(0);
  });
}

for (const fixed of [false, true]) {
  const version = fixed ? 'after the fixes' : 'before the fixes';
  const pair = fixed ? 'good (after the fixes)' : 'bad (before the fixes)';
  test(`release: a flick dismisses, a slow short drag snaps back fast: ${pair}`, async ({ page }, testInfo) => {
    story.init(testInfo);
    story.given(`an open sheet, ${version}`);
    let h = await openSheet(page, fixed);
    story.when('the handle is dragged 60px slowly and let go');
    await page.mouse.move(h.x, h.y);
    await page.mouse.down();
    await page.mouse.move(h.x, h.y + 60, { steps: 6 });
    // Held still on purpose, so the release carries no speed.
    await page.waitForTimeout(300);
    await page.mouse.up();
    const snap = (await inventory(page)).filter((r) => r.target === '.sheet');
    story.table({ label: 'Snap-back', columns: ['Driver', 'Duration', 'Easing'], rows: snap.map((r) => [r.kind, `${r.duration}ms`, r.easing]) });
    await settle(page);
    await expect(page.locator('.sheet')).toBeVisible();
    story.then(fixed ? 'it snaps back in 200ms on the drawer curve' : 'it crawls back over 600ms with ease-in');
    expect(snap[0]!.duration).toBe(fixed ? 200 : 600);

    story.when('the handle is flicked 60px quickly');
    h = await openSheet(page, fixed);
    await page.mouse.move(h.x, h.y);
    await page.mouse.down();
    await page.mouse.move(h.x, h.y + 60, { steps: 3 });
    await page.mouse.up();
    await settle(page);
    await story.screenshot({ page, alt: `After the flick, ${version}`, fullPage: false });
    story.then(fixed ? 'velocity alone dismisses it' : 'it is ignored, because only distance counts');
    await expect(page.locator('.sheet')).toBeVisible({ visible: !fixed });
  });
}

for (const fixed of [false, true]) {
  const version = fixed ? 'after the fixes' : 'before the fixes';
  const pair = fixed ? 'good (after the fixes)' : 'bad (before the fixes)';
  test(`grabbing it mid-close catches it where it is: ${pair}`, async ({ page }, testInfo) => {
    story.init(testInfo);
    story.given(`an open sheet, ${version}, animations at 1/5 speed`);
    await openSheet(page, fixed);
    await playbackRate(page, 0.2);
    story.when('Close is pressed, and the handle is grabbed part-way down');
    await page.getByRole('button', { name: 'Close' }).click();
    // Fixed waits on purpose: grab the sheet part-way through the slowed close, then hold it.
    await page.waitForTimeout(500);
    const box = (await page.locator('.handle').boundingBox())!;
    const caughtAt = await sheetY(page);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(2500);
    const after = await page.locator('.sheet').isVisible() ? await sheetY(page) : null;
    await story.screenshot({ page, alt: `Held mid-close, ${version}`, fullPage: false });
    await page.mouse.up();
    story.kv({ label: 'Caught at (px), held at (px)', value: [Math.round(caughtAt), after === null ? 'gone' : Math.round(after)] });
    if (fixed) {
      story.then('it stops under the finger and stays there');
      expect(after).not.toBeNull();
      expect(Math.abs(after! - caughtAt)).toBeLessThan(40);
    } else {
      story.then('the keyframe animation ignores the finger and finishes closing');
      expect(after).toBeNull();
    }
  });
}

for (const fixed of [false, true]) {
  const version = fixed ? 'after the fixes' : 'before the fixes';
  const pair = fixed ? 'good (after the fixes)' : 'bad (before the fixes)';
  test(`hit target, touch-action and press feedback: ${pair}`, async ({ page }, testInfo) => {
    story.init(testInfo);
    story.given(`an open sheet, ${version}`);
    const h = await openSheet(page, fixed);
    const target = fixed ? '.grab' : '.handle';
    const size = (await page.locator(target).boundingBox())!;
    const touchAction = await page.locator(target).evaluate((el) => getComputedStyle(el).touchAction);
    const missesBelow = await page.evaluate(({ x, y, t }) => !document.elementFromPoint(x, y + 16)?.closest(t), { x: h.x, y: h.y, t: target });
    const colour = () => page.locator('.handle').evaluate((el) => getComputedStyle(el).backgroundColor);
    const idle = await colour();
    await page.mouse.move(h.x, h.y);
    await page.mouse.down();
    const pressed = await colour();
    await story.screenshot({ page, alt: `Handle pressed, ${version}`, fullPage: false });
    await page.mouse.up();
    story.table({
      label: 'Touch checklist',
      columns: ['Check', 'Measured'],
      rows: [['Drag target height', `${size.height}px`], ['touch-action', touchAction], ['A press 16px below the handle misses it', String(missesBelow)], ['Colour changes on pointer-down', String(idle !== pressed)]],
    });
    if (fixed) {
      story.then('a 44px target that owns the vertical axis and reacts the moment the finger lands');
      expect(size.height).toBeGreaterThanOrEqual(44);
      expect(touchAction).toBe('pan-x');
      expect(missesBelow).toBe(false);
      expect(pressed).not.toBe(idle);
    } else {
      story.then('a 5px target, the browser free to scroll, and no feedback until release');
      expect(size.height).toBeLessThan(44);
      expect(touchAction).toBe('auto');
      expect(missesBelow).toBe(true);
      expect(pressed).toBe(idle);
    }
  });
}

for (const fixed of [false, true]) {
  const version = fixed ? 'after the fixes' : 'before the fixes';
  const pair = fixed ? 'good (after the fixes)' : 'bad (before the fixes)';
  test(`a second finger is ignored once a drag has started: ${pair}`, async ({ browser }, testInfo) => {
    story.init(testInfo);
    const page = await browser.newPage({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });
    story.given(`an open sheet on a touch screen, ${version}`);
    const h = await openSheet(page, fixed);
    const cdp = await page.context().newCDPSession(page);
    const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', points: { x: number; y: number; id: number }[]) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points });
    story.when('one finger drags the handle 50px, a second finger lands lower, then both move');
    await touch('touchStart', [{ x: h.x, y: h.y, id: 0 }]);
    await touch('touchMove', [{ x: h.x, y: h.y + 50, id: 0 }]);
    await touch('touchStart', [{ x: h.x, y: h.y + 50, id: 0 }, { x: h.x + 60, y: h.y + 300, id: 1 }]);
    await touch('touchMove', [{ x: h.x, y: h.y + 80, id: 0 }, { x: h.x + 60, y: h.y + 300, id: 1 }]);
    await touch('touchMove', [{ x: h.x, y: h.y + 80, id: 0 }, { x: h.x + 60, y: h.y + 340, id: 1 }]);
    await settle(page);
    const y = await sheetY(page);
    await story.screenshot({ page, alt: `Two fingers, ${version}`, fullPage: false });
    await touch('touchEnd', []);
    story.kv({ label: 'Sheet position (px) after the first finger moved 80px', value: Math.round(y) });
    story.then(fixed ? 'it follows the first finger to 80px and ignores the second' : 'the browser cancels the drag when the second finger lands (nothing claimed the axis with touch-action), and the sheet freezes at 50px');
    expect(y).toBeCloseTo(fixed ? 80 : 50, 0);
    await page.close();
  });
}

for (const fixed of [false, true]) {
  const version = fixed ? 'after the fixes' : 'before the fixes';
  const pair = fixed ? 'good (after the fixes)' : 'bad (before the fixes)';
  test(`reduced motion: dismissing fades instead of sliding: ${pair}`, async ({ page }, testInfo) => {
    story.init(testInfo);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    story.given(`an open sheet, the user prefers reduced motion, ${version}`);
    const h = await openSheet(page, fixed);
    story.when('it is flicked away');
    await page.mouse.move(h.x, h.y);
    await page.mouse.down();
    await page.mouse.move(h.x, h.y + 300, { steps: 3 });
    await page.mouse.up();
    const running = (await inventory(page)).filter((r) => r.target === '.sheet');
    await story.screenshot({ page, alt: `Dismissing with reduced motion, ${version}`, fullPage: false });
    story.table({ label: 'Dismiss animation', columns: ['Driver', 'Properties', 'Duration'], rows: running.map((r) => [r.kind, r.properties.join(', '), `${r.duration}ms`]) });
    story.then(fixed ? 'a 150ms fade; the drag itself still tracked the finger' : 'it still slides');
    expect([...new Set(running.flatMap((r) => r.properties))]).toEqual(fixed ? ['opacity'] : ['transform']);
  });
}
