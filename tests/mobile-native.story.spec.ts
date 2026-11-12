import { test, expect, type Page } from './lib/test';
import { settle } from './lib/motion';
import { story } from 'executable-stories-playwright';

story.feature({
  title: 'mobile-native: the platform layer, on an emulated phone',
  narrative:
    'skills/mobile-native\'s symptom table, checked in Chromium with phone emulation (touch, no hover, coarse pointer). Meta tags, computed styles and ' +
    'stylesheet rules are read directly; sticky hover and press feedback are checked with real taps. The skill is clear that emulation is not a phone, so ' +
    'every run also lists what still needs hardware. Claude in Chrome on a desktop cannot do better: it is the same engine, without even the emulation.',
  tags: ['mobile-native'],
});

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

const open = (page: Page, fixed: boolean) => page.goto(`/mobile.html${fixed ? '?fixed' : ''}`);

/** Each row of the skill's symptom table that the page itself can answer. */
async function audit(page: Page) {
  return page.evaluate(() => {
    const css = (sel: string) => getComputedStyle(document.querySelector(sel)!);
    const meta = (name: string) => [...document.querySelectorAll<HTMLMetaElement>(`meta[name="${name}"]`)];
    const viewport = meta('viewport')[0]?.content ?? '';
    const rules: CSSStyleRule[] = [];
    const walk = (list: CSSRuleList, media: string) => {
      for (const r of list) {
        if (r instanceof CSSMediaRule) { if (matchMedia(r.conditionText).matches || /hover|pointer/.test(r.conditionText)) walk(r.cssRules, r.conditionText); }
        else if (r instanceof CSSStyleRule && document.querySelector(r.selectorText.replace(/:(hover|active)/g, ''))) rules.push(Object.assign(r, { media }));
      }
    };
    for (const s of document.styleSheets) walk(s.cssRules, '');
    const declared = (sel: RegExp, prop: string) => rules.filter((r) => sel.test(r.selectorText)).map((r) => r.style.getPropertyValue(prop)).filter(Boolean);
    const ungatedHover = rules.some((r) => r.selectorText.includes(':hover') && !/hover: ?hover/.test((r as CSSStyleRule & { media: string }).media));
    const inputs = [...document.querySelectorAll('input')];
    const buttons = [...document.querySelectorAll<HTMLElement>('.button, a')];
    const transparent = (c: string) => /rgba\(0, 0, 0, 0\)|transparent/.test(c);

    return [
      ['Zoom disabled', 'no user-scalable=no or maximum-scale=1', !/user-scalable=no|maximum-scale=1/.test(viewport)],
      ['Content stops at the notch', 'viewport-fit=cover, and env(safe-area-inset-*) on fixed bars', viewport.includes('viewport-fit=cover') && declared(/tabbar/, 'padding-bottom').some((v) => v.includes('safe-area-inset-bottom')) && declared(/header/, 'padding-top').some((v) => v.includes('safe-area-inset-top'))],
      ['Status bar colour', 'one theme-color per colour scheme', meta('theme-color').filter((m) => m.media).length === 2],
      ['Page zooms into input', 'every input at 16px or more', inputs.every((i) => parseFloat(getComputedStyle(i).fontSize) >= 16)],
      ['Wrong keyboard', 'type=email, inputmode=numeric, autocomplete, enterkeyhint', document.querySelector<HTMLInputElement>('.email')!.type === 'email' && document.querySelector<HTMLInputElement>('.code')!.inputMode === 'numeric' && inputs.every((i) => i.enterKeyHint)],
      ['Grey flash on tap', '-webkit-tap-highlight-color: transparent on html', transparent(css('html').getPropertyValue('-webkit-tap-highlight-color'))],
      ['Tap feels laggy', 'touch-action: manipulation on controls', buttons.every((b) => getComputedStyle(b).touchAction === 'manipulation')],
      ['Layout has the wrong height', 'app shell in dvh, not vh', declared(/\.app$/, 'height').some((v) => v.includes('dvh'))],
      ['Pull-to-refresh hijacks scroll', 'overscroll-behavior none on html/body, contain on inner scrollers', css('html').overscrollBehaviorY === 'none' && css('.sheet-content').overscrollBehaviorY === 'contain'],
      ['Long-press selects button text', 'user-select none on controls, not on body', buttons.every((b) => getComputedStyle(b).userSelect === 'none') && css('body').userSelect !== 'none'],
      ['Carousel scrolls vertically', 'scroll-snap on the track, or touch-action: pan-y', css('.carousel').scrollSnapType.startsWith('x') || css('.carousel').touchAction === 'pan-y'],
      ['Hover state stuck after tap', 'every :hover rule inside (hover: hover) and (pointer: fine)', !ungatedHover],
    ] as [string, string, boolean][];
  });
}

for (const fixed of [false, true]) {
  const version = fixed ? 'after the fixes' : 'before the fixes';
  const pair = fixed ? 'good (after the fixes)' : 'bad (before the fixes)';
  test(`the symptom table: ${pair}`, async ({ page }, testInfo) => {
    story.init(testInfo);
    story.given(`the sign-in screen on an emulated phone, ${version}`);
    await open(page, fixed);
    await story.screenshot({ page, alt: `Sign-in, ${version}`, fullPage: false });
    story.when('each symptom\'s fix is looked for in the meta tags, computed styles and stylesheets');
    const rows = await audit(page);
    story.table({ label: 'Symptom table', columns: ['Problem', 'Fix looked for', 'Present'], rows: rows.map(([p, f, ok]) => [p, f, ok ? 'yes' : 'NO']) });
    const missing = rows.filter(([, , ok]) => !ok).map(([p]) => p);
    story.then(fixed ? 'every fix is in place' : 'every fix is missing');
    expect(missing).toEqual(fixed ? [] : rows.map(([p]) => p));
  });
}

for (const fixed of [false, true]) {
  const version = fixed ? 'after the fixes' : 'before the fixes';
  const pair = fixed ? 'good (after the fixes)' : 'bad (before the fixes)';
  test(`tapping a button: no sticky hover, feedback on press: ${pair}`, async ({ page }, testInfo) => {
    story.init(testInfo);
    story.given(`the Continue button, ${version}`);
    await open(page, fixed);
    const button = page.getByRole('button', { name: 'Continue' });
    const scale = () => button.evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).a);
    const box = (await button.boundingBox())!;
    // A held CDP touch never reaches Chrome's tap gesture, so :active can't be held by a synthetic finger; pointer-down can.
    story.when('the pointer goes down on it');
    await page.mouse.move(box.x + 10, box.y + 10);
    await page.mouse.down();
    await settle(button);
    const down = await scale();
    await story.screenshot({ page, alt: `Pressed, ${version}`, fullPage: false });
    await page.mouse.up();
    story.when('a finger taps it (a real touch tap)');
    await open(page, fixed);
    await button.tap();
    await settle(button);
    const after = await scale();
    await story.screenshot({ page, alt: `After the tap, ${version}`, fullPage: false });
    story.kv({ label: 'Scale while pressed, scale after the tap', value: [down, after] });
    if (fixed) {
      story.then('it presses in while the finger is down and lets go fully');
      expect(down).toBeCloseTo(0.97);
      expect(after).toBe(1);
    } else {
      story.then('no press state (only the hover scale), and the hover scale sticks after the finger has gone');
      expect(down).toBeGreaterThanOrEqual(1);
      expect(after).toBeCloseTo(1.05);
    }
  });
}

for (const fixed of [false, true]) {
  const version = fixed ? 'after the fixes' : 'before the fixes';
  const pair = fixed ? 'good (after the fixes)' : 'bad (before the fixes)';
  test(`the status bar matches the header in light and dark: ${pair}`, async ({ page }, testInfo) => {
    story.init(testInfo);
    const rows: string[][] = [];
    for (const colorScheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme });
      await open(page, fixed);
      const [bar, header] = await page.evaluate(() => [
        [...document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')].find((m) => !m.media || matchMedia(m.media).matches)?.content,
        getComputedStyle(document.querySelector('header')!).backgroundColor,
      ]);
      const hex = await page.evaluate((c) => '#' + c!.match(/\d+/g)!.slice(0, 3).map((n) => Number(n).toString(16).padStart(2, '0')).join(''), header);
      rows.push([colorScheme, bar ?? '', hex]);
      await story.screenshot({ page, alt: `${colorScheme}, ${version}`, fullPage: false });
    }
    story.table({ label: 'theme-color against the header', columns: ['Scheme', 'theme-color', 'Header'], rows });
    const mismatched = rows.filter(([, bar, header]) => bar !== header).map(([s]) => s);
    story.then(fixed ? 'they match in both' : 'in dark mode a white status bar sits over a near-black header');
    expect(mismatched).toEqual(fixed ? [] : ['dark']);
  });
}

test('what still needs a phone', async ({ page }, testInfo) => {
  story.init(testInfo);
  story.given('the skill\'s fix 11: "Right in Chrome, wrong on phone"');
  await open(page, true);
  await story.screenshot({ page, alt: 'The fixed sign-in screen, emulated', fullPage: false });
  story.table({
    label: 'Not provable in emulation (Playwright or Claude in Chrome)',
    columns: ['Behaviour', 'What the run above proved instead'],
    rows: [
      ['iOS input zoom', 'Inputs compute to 16px'],
      ['Press state under a held finger', ':active applies on pointer-down (a synthetic held touch never triggers it)'],
      ['Real 300ms tap delay', 'touch-action: manipulation is applied'],
      ['URL bar changing the viewport height', 'The shell is sized in dvh'],
      ['Rubber-banding and pull-to-refresh', 'overscroll-behavior is set'],
      ['Notch and home indicator insets', 'viewport-fit=cover and env() are declared (env() is 0px here)'],
      ['Software keyboard covering inputs', 'interactive-widget=resizes-content is declared'],
      ['Gesture feel at 120Hz', 'Tracking and velocity, in gestures.story.spec.ts'],
    ],
  });
  story.then('these are confirmed on a device, by IP, with Safari Web Inspector or chrome://inspect');
  expect(await page.locator('meta[name="viewport"]').getAttribute('content')).toContain('interactive-widget=resizes-content');
});
