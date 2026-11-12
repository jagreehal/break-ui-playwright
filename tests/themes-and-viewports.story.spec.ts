import { test, expect, watchErrors, type Page } from './lib/test';
import { settle } from './lib/motion';
import { story } from 'executable-stories-playwright';
import { NOW } from '../app/fixtures.js';
import { summarise, wholePage } from './lib/report';

story.feature({
  title: 'every page in light and dark, on desktop and phone',
  narrative:
    'Each demo page, before and after its fixes, in light and dark mode at desktop and phone size. Two checks that hold for any page: ' +
    'nothing makes the page scroll sideways, and all visible text meets WCAG AA contrast (4.5:1). A fix that only works in one theme or at one width fails here.',
  tags: ['break-ui', 'mobile-native', 'theme', 'viewport'],
});

// Each page in the state worth looking at: data loaded, sheet open, toast showing.
const pages: { name: string; url: string; prepare?: (page: Page) => Promise<unknown> }[] = [
  { name: 'members (break-ui)', url: '/members.html?data=worst', prepare: (p) => p.waitForFunction(() => 'ready' in document.body.dataset) },
  { name: 'mobile (mobile-native)', url: '/mobile.html' },
  { name: 'motion (animation skills)', url: '/motion.html' },
  { name: 'sheet (gestures)', url: '/sheet.html', prepare: async (p) => { await p.getByRole('button', { name: 'Open sheet' }).click(); await settle(p); } },
  { name: 'toast (ask-sonner)', url: '/toast.html', prepare: async (p) => { await p.getByRole('button', { name: 'Save' }).click(); await settle(p.locator('[data-sonner-toast]').first()); } },
  { name: 'prototype', url: '/prototype.html', prepare: (p) => p.locator('#stage form').waitFor() },
];

const sizes = {
  desktop: { viewport: { width: 1280, height: 800 } },
  phone: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
};

// What must break before the fixes. Everything else must hold in both versions.
const expectBefore: Record<string, string[]> = {
  // Hardcoded white rows under light text.
  'members (break-ui), desktop, dark': ['low contrast'],
  'members (break-ui), phone, dark': ['low contrast'],
  // No color-scheme meta, so links keep their light-mode blue on the dark tab bar.
  'mobile (mobile-native), desktop, dark': ['low contrast'],
  'mobile (mobile-native), phone, dark': ['low contrast'],
};

/** Sideways scroll, and every visible text element under 4.5:1 against the background it sits on. */
function check(page: Page) {
  return page.evaluate(() => {
    const found: string[] = [];
    const doc = document.scrollingElement!;
    if (doc.scrollWidth > innerWidth + 1) found.push(`scrolls sideways: page is ${doc.scrollWidth}px in a ${innerWidth}px viewport`);
    const lum = (c: string) => {
      const [r, g, b] = c.match(/[\d.]+/g)!.slice(0, 3).map(Number).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
      return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
    };
    const bg = (el: Element | null): string => {
      for (; el; el = el.parentElement) {
        const c = getComputedStyle(el).backgroundColor;
        if (!/rgba\(.*, 0\)|transparent/.test(c)) return c;
      }
      // Nothing painted: the canvas, which follows color-scheme.
      return matchMedia('(prefers-color-scheme: dark)').matches && getComputedStyle(document.documentElement).colorScheme.includes('dark') ? 'rgb(18, 18, 18)' : 'rgb(255, 255, 255)';
    };
    for (const el of document.querySelectorAll('body *')) {
      const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent!.trim());
      const s = getComputedStyle(el);
      const box = el.getBoundingClientRect();
      if (!own || s.visibility === 'hidden' || s.opacity === '0' || !box.width || el.closest('[hidden], .toggle, .proto-picker, [aria-hidden="true"]')) continue;
      if (/rgba\(.*, 0(\.\d+)?\)/.test(s.color) && !s.color.startsWith('rgb(')) continue; // translucent text: skip, can't resolve reliably
      const [a, b] = [lum(s.color), lum(bg(el))].sort((x, y) => y - x);
      const ratio = (a! + 0.05) / (b! + 0.05);
      if (ratio < 4.5) found.push(`low contrast: ${ratio.toFixed(1)}:1 on <${el.tagName.toLowerCase()}> "${el.textContent!.trim().slice(0, 30)}"`);
    }
    return [...new Set(found)];
  });
}

for (const p of pages) {
  for (const [size, options] of Object.entries(sizes)) {
    for (const colorScheme of ['light', 'dark'] as const) {
      for (const fixed of [false, true]) {
        const version = fixed ? 'after the fixes' : 'before the fixes';
        const pair = fixed ? 'good (after the fixes)' : 'bad (before the fixes)';
        const key = `${p.name}, ${size}, ${colorScheme}`;

        test(`${key}: ${pair}`, async ({ browser }, testInfo) => {
          story.init(testInfo);
          const context = await browser.newContext({ ...options, colorScheme, baseURL: 'http://localhost:4377' });
          const page = await context.newPage();
          const errors = watchErrors(page);
          await page.clock.setFixedTime(NOW);
          story.given(`${p.name}, ${version}, ${size}, ${colorScheme} mode`);
          await page.goto(p.url + (p.url.includes('?') ? '&' : '?') + (fixed ? 'fixed' : ''));
          await p.prepare?.(page);
          // Members has a fixed toggle bar and no vh sizing; the phone pages that do use vh keep Playwright's fullPage.
          if (size === 'phone' && p.url.startsWith('/members')) await wholePage(page, `${key}, ${version}`);
          else await story.screenshot({ page, alt: `${key}, ${version}`, fullPage: size === 'phone' });

          story.when('it is checked for sideways scrolling and text contrast');
          const found = await check(page);
          summarise('Problems', found.map((f) => ({ kind: f.split(':')[0]!, where: f.slice(f.indexOf(':') + 2) })));
          const kinds = [...new Set(found.map((f) => f.split(':')[0]!))];
          const expected = fixed ? [] : (expectBefore[key] ?? []);
          story.then(expected.length ? `it shows the expected breaks: ${expected.join(', ')}` : 'it fits the screen and every line of text is readable');
          expect(kinds.sort()).toEqual([...expected].sort());
          // This test makes its own page, so it checks browser errors itself. Allowed: the members page's planted missing
          // avatar, and the planted React key bug in the prototype before the fixes.
          const allowed = fixed ? /avatars\/missing\.png/ : /avatars\/missing\.png|unique "key" prop/;
          expect(errors.filter((e) => !allowed.test(e)), 'unexpected browser errors').toEqual([]);
          await context.close();
        });
      }
    }
  }
}
