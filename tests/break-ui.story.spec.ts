import { test, expect, type Page } from './lib/test';
import { story } from 'executable-stories-playwright';
import { NOW, fields } from '../app/fixtures.js';
import { findBreaks, SIGNATURES, type Signature } from './lib/break-ui';
import { summarise, wholePage } from './lib/report';

story.feature({
  title: 'break-ui: feed the members list the worst realistic data',
  narrative:
    'skills/break-ui run through Playwright. Each case loads the list with one dataset in one environment, measures every failure signature in the skill, and screenshots it. ' +
    'Before the fixes the breaks must be found (if they are not, Playwright missed them); after the fixes there must be none.',
  tags: ['break-ui'],
});

type Case = { name: string; data?: string; url?: string; setup?: (page: Page) => Promise<unknown>; expectBefore: Signature[] };

async function open(page: Page, c: Case, fixed: boolean) {
  await page.clock.setFixedTime(NOW);
  await c.setup?.(page);
  await page.goto(`/members.html?data=${c.data ?? 'worst'}${c.url ?? ''}${fixed ? '&fixed' : ''}`);
  await page.waitForFunction(() => 'ready' in document.body.dataset, null, { timeout: 3000 }).catch(() => {});
}

// What each case must find before the fixes. Measured, then checked by eye against the screenshots.
const WORST_DESKTOP: Signature[] = [
  'avatar-squished', 'avatar-adrift', 'clipped', 'badge-wraps', 'button-overflows', 'wrong-initials', 'orphan-placeholder',
  'wrong-plural', 'raw-number', 'bad-relative-time', 'broken-image', 'image-distorted', 'truncated-unreadable',
  'markup-from-data', 'tag-wall', 'tight-line-height', 'proportional-figures',
];
// Fine on any data, so demo data shows them too; everything else needs worst-case data to appear.
const STYLE_ONLY: Signature[] = ['proportional-figures', 'tight-line-height'];

// Phase 4: the real container width, then 320px and the widest layout; 200% text; dark mode; RTL. Touch is below.
const environments: Case[] = [
  { name: 'desktop 1280px', expectBefore: WORST_DESKTOP },
  { name: 'phone 320px', setup: (p) => p.setViewportSize({ width: 320, height: 640 }), expectBefore: ['text-overflows', 'email-past-edge', 'action-unreachable', 'word-break-all', 'clipped'] },
  { name: 'widest 2560px', setup: (p) => p.setViewportSize({ width: 2560, height: 1200 }), expectBefore: ['lines-too-long'] },
  { name: 'text at 200%', setup: (p) => p.addInitScript(() => addEventListener('DOMContentLoaded', () => { document.documentElement.style.fontSize = '200%'; })), expectBefore: ['clipped', 'avatar-squished', 'word-break-all', 'button-overflows'] },
  { name: 'dark mode', setup: (p) => p.emulateMedia({ colorScheme: 'dark' }), expectBefore: ['low-contrast'] },
  { name: 'right to left', url: '&dir=rtl', expectBefore: ['action-wrong-side'] },
];

// Phase 2's other datasets. Empty, API errors and slow loading have their own tests below.
const datasets: Case[] = [
  { name: 'demo data', data: 'demo', expectBefore: [] },
  { name: 'one member', data: 'one', expectBefore: ['wrong-plural'] },
  { name: '1,000 members', data: 'huge', expectBefore: ['all-rows-rendered', 'raw-number'] },
];

// The worst-case data has a member whose avatar image is missing, on purpose.
test.use({ allowedErrors: /avatars\/missing\.png/ });

for (const c of [...environments, ...datasets]) {
  for (const fixed of [false, true]) {
    const version = fixed ? 'after the fixes' : 'before the fixes';
    const pair = fixed ? 'good (after the fixes)' : 'bad (before the fixes)';
    test(`${c.data ? c.name : `worst case, ${c.name}`}: ${pair}`, async ({ page }, testInfo) => {
      story.init(testInfo);
      story.given(`the members list ${version}, loaded with ${c.data ?? 'worst-case'} data, ${c.name}`);
      await open(page, c, fixed);
      const alt = `${c.data ?? 'worst case'}, ${c.name}, ${version}`;
      await (c.data === 'huge' ? story.screenshot({ page, alt }) : wholePage(page, alt));

      story.when('every failure signature in the skill is measured');
      const found = await findBreaks(page);
      const order = ['Broken', 'Ugly', 'Fragile'];
      found.sort((a, b) => order.indexOf(SIGNATURES[a.signature][0]) - order.indexOf(SIGNATURES[b.signature][0]));
      summarise('Part 1: what broke', found.map((f) => ({ kind: f.signature, where: f.where })), (k) => { const [severity, what, fix] = SIGNATURES[k as Signature]; return [severity, what, fix]; }, ['Severity', 'What happens', 'Fix']);

      const signatures = [...new Set(found.map((f) => f.signature))];
      if (fixed) {
        story.then('nothing breaks');
        expect(signatures).toEqual([]);
      } else {
        if (c.data === 'demo') {
          story.then('demo data hides every data break; only the two style-level issues show');
          expect(signatures.filter((s) => !STYLE_ONLY.includes(s))).toEqual([]);
        } else {
          story.then(`the breaks are found: ${c.expectBefore.join(', ')}`);
          expect(signatures).toEqual(expect.arrayContaining(c.expectBefore));
        }
      }
    });
  }
}

for (const fixed of [false, true]) {
  const version = fixed ? 'after the fixes' : 'before the fixes';
  const pair = fixed ? 'good (after the fixes)' : 'bad (before the fixes)';
  test(`touch device: the row actions are reachable without hover: ${pair}`, async ({ browser }, testInfo) => {
    story.init(testInfo);
    const page = await browser.newPage({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });
    story.given(`a phone, with no hover, ${version}`);
    await open(page, { name: 'touch', data: 'demo', expectBefore: [] }, fixed);
    await story.screenshot({ page, alt: `Touch, ${version}` });
    story.then(fixed ? 'every ••• menu is visible' : 'the ••• menu only appears on hover, so a phone can never reach it');
    const hidden = await page.locator('.menu').evaluateAll((els) => els.filter((e) => getComputedStyle(e).opacity === '0').length);
    expect(hidden > 0).toBe(!fixed);
    await page.close();
  });
}

for (const fixed of [false, true]) {
  const version = fixed ? 'after the fixes' : 'before the fixes';
  const pair = fixed ? 'good (after the fixes)' : 'bad (before the fixes)';
  test(`empty list: ${pair}`, async ({ page }, testInfo) => {
    story.init(testInfo);
    story.given(`a workspace with no members, ${version}`);
    await open(page, { name: 'empty', data: 'empty', expectBefore: [] }, fixed);
    await story.screenshot({ page, alt: `Empty, ${version}` });
    story.then(fixed ? 'it says there is nobody yet' : 'it shows nothing, and "0 members" in the header');
    await expect(page.getByRole('status')).toHaveCount(fixed ? 1 : 0);
  });
}

for (const fixed of [false, true]) {
  const version = fixed ? 'after the fixes' : 'before the fixes';
  const pair = fixed ? 'good (after the fixes)' : 'bad (before the fixes)';
  // An anonymous describe, so test.use applies to this test alone.
  test.describe(() => {
    test.use({ allowedErrors: fixed ? /status of 500/ : /status of 500|pageerror: .* is not valid JSON/ });
    test(`API error: ${pair}`, async ({ page }, testInfo) => {
      story.init(testInfo);
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      story.given(`the members API returns a 500, ${version}`);
      await open(page, { name: 'error', setup: (p) => p.route('**/api/members*', (r) => r.fulfill({ status: 500, body: 'Internal Server Error' })), expectBefore: [] }, fixed);
      await story.screenshot({ page, alt: `API error, ${version}` });
      story.then(fixed ? 'it says so and offers a retry' : 'the page throws and stays blank');
      await expect(page.getByRole('alert')).toHaveCount(fixed ? 1 : 0);
      expect(errors.length > 0).toBe(!fixed);
    });
  });
}

for (const fixed of [false, true]) {
  const version = fixed ? 'after the fixes' : 'before the fixes';
  const pair = fixed ? 'good (after the fixes)' : 'bad (before the fixes)';
  test(`slow API: ${pair}`, async ({ page }, testInfo) => {
    story.init(testInfo);
    story.given(`the members API takes two seconds, ${version}`);
    await page.route('**/api/members*', async (r) => { await new Promise((ok) => setTimeout(ok, 2000)); await r.continue(); });
    await page.goto(`/members.html?data=demo${fixed ? '&fixed' : ''}`);
    await story.screenshot({ page, alt: `Loading, ${version}` });
    story.then(fixed ? 'a skeleton the height of a real row holds the space' : 'the page is blank while it waits');
    await expect(page.locator('[aria-busy="true"]')).toHaveCount(fixed ? 3 : 0);
  });
}

test('the Demo / Worst case toggle swaps fixtures at the data boundary and survives a reload', async ({ page }, testInfo) => {
  story.init(testInfo);
  story.given('the list on demo data');
  await page.goto('/members.html?fixed');
  await expect(page.locator('li.member')).toHaveCount(3);
  story.table({ label: 'Phase 1: the surface', columns: ['Field', 'Rendered as', 'Type', 'Limit', 'Optional?'], rows: fields });

  for (const [label, rows] of [['Worst case', 10], ['One', 1], ['1,000 rows', 50], ['Empty', 0]] as const) {
    story.when(`"${label}" is pressed`);
    await page.getByRole('button', { name: label }).click();
    await expect(page.locator('li.member')).toHaveCount(rows);
    await story.screenshot({ page, alt: label });
  }
  story.then('the choice is in the URL, so a reload keeps it');
  await page.reload();
  await expect(page).toHaveURL(/data=empty/);
  await expect(page.getByRole('button', { name: 'Empty' })).toHaveAttribute('aria-pressed', 'true');
});
