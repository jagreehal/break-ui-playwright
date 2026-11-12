import { test, expect, type Page } from './lib/test';
import { story } from 'executable-stories-playwright';

story.feature({
  title: 'prototype: verify the variants and the picker before handing off',
  narrative:
    'skills/prototype Phase 5: "confirm every variant renders, every interaction responds, and the console is clean ... screenshot each variant", ' +
    'plus the picker\'s behaviour contract from PICKER.md. The before harness breaks four clauses; the after harness is PICKER.md verbatim.',
  tags: ['prototype'],
});

const NAMES = ['Quiet', 'Editorial', 'Playful'];
const picker = (page: Page) => page.getByRole('navigation', { name: 'Prototype variants' });
const active = (page: Page) => picker(page).locator('[data-active]');
const open = async (page: Page, fixed: boolean, query = '') => {
  await page.goto(`/prototype.html?${fixed ? 'fixed&' : ''}${query}`);
  await expect(page.locator('#stage form')).toBeVisible();
};

for (const fixed of [false, true]) {
  const version = fixed ? 'after the fixes' : 'before the fixes';
  const pair = fixed ? 'good (after the fixes)' : 'bad (before the fixes)';
  // An anonymous describe, so test.use applies to this test alone.
  test.describe(() => {
    test.use({ allowedErrors: fixed ? undefined : /unique "key" prop/ });
    test(`every variant renders, responds, and keeps the console clean: ${pair}`, async ({ page }, testInfo) => {
      story.init(testInfo);
      const errors: string[] = [];
      page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
      page.on('pageerror', (e) => errors.push(e.message));
      story.given(`the invite prototypes, ${version}`);
      await open(page, fixed);
      const rows: string[][] = [];
      for (const name of NAMES) {
        story.when(`${name} is picked, and an invite is sent from it`);
        await picker(page).getByRole('button', { name }).click();
        await page.locator('#stage input').fill('aleksandra@northwind.example.com');
        await page.locator('#stage .send').click();
        const sent = await page.locator('#stage [role=status]').textContent();
        await story.screenshot({ page, alt: `${name}, ${version}`, fullPage: false });
        rows.push([name, sent ? 'yes' : 'NO (dead button)', String(errors.length)]);
      }
      story.table({ label: 'Phase 5 checks', columns: ['Variant', 'Send responds', 'Console errors so far'], rows });
      if (fixed) {
        story.then('all three work and the console is clean');
        expect(rows.map((r) => r[1])).toEqual(['yes', 'yes', 'yes']);
        expect(errors).toEqual([]);
      } else {
        story.then('Playful\'s button does nothing, and Editorial logs an error');
        expect(rows.map((r) => r[1])).toEqual(['yes', 'yes', 'NO (dead button)']);
        expect(errors.length).toBeGreaterThan(0);
      }
    });
  });
}

for (const fixed of [false, true]) {
  const version = fixed ? 'after the fixes' : 'before the fixes';
  const pair = fixed ? 'good (after the fixes)' : 'bad (before the fixes)';
  // An anonymous describe, so test.use applies to this test alone.
  test.describe(() => {
    test.use({ allowedErrors: fixed ? undefined : /unique "key" prop/ });
    test(`the picker contract: ${pair}`, async ({ page }, testInfo) => {
      story.init(testInfo);
      story.given(`the picker, ${version}`);
      await open(page, fixed);
      const rows: [string, boolean][] = [];

      story.when('each item is clicked');
      let oneActive = true;
      for (const name of NAMES) {
        await picker(page).getByRole('button', { name }).click();
        oneActive &&= (await active(page).count()) === 1 && (await picker(page).locator('[aria-current="true"]').textContent()) === name;
      }
      rows.push(['Exactly one item is active and aria-current', oneActive]);

      story.when('2 is pressed while typing in the email field');
      await picker(page).getByRole('button', { name: 'Quiet' }).click();
      await page.locator('#stage input').press('2');
      rows.push(['Number keys are ignored in inputs', (await active(page).textContent()) === 'Quiet']);

      story.when('Ctrl+2, then 3, then ArrowLeft are pressed outside the field');
      await picker(page).getByRole('button', { name: 'Quiet' }).click();
      await page.locator('h1').click();
      await page.keyboard.press('Control+2');
      const modifierIgnored = (await active(page).textContent()) === 'Quiet';
      await page.keyboard.press('3');
      const three = (await active(page).textContent()) === 'Playful';
      await page.keyboard.press('ArrowLeft');
      rows.push(['Modifier keys are ignored', modifierIgnored], ['1-N and arrows switch', three && (await active(page).textContent()) === 'Editorial']);

      story.when('a variant is picked');
      const swapAnimates = await page.evaluate(async () => {
        (document.querySelectorAll('.proto-picker-item')[2] as HTMLElement).click();
        await new Promise(requestAnimationFrame);
        return document.getAnimations().some((a) => (a.effect as KeyframeEffect).target === document.getElementById('stage'));
      });
      rows.push(['The variant swap is instant', !swapAnimates]);

      story.when('R is pressed');
      await page.evaluate(() => { (document.querySelector('#stage form') as HTMLElement & { marked?: boolean }).marked = true; });
      await page.keyboard.press('r');
      await expect(page.locator('#stage form')).toBeVisible();
      rows.push(['R re-mounts the variant', await page.evaluate(() => !(document.querySelector('#stage form') as HTMLElement & { marked?: boolean }).marked)]);

      story.when('the page is reloaded');
      await page.reload();
      await expect(page.locator('#stage form')).toBeVisible();
      rows.push(['The choice survives a reload (?v=)', (await active(page).textContent()) === 'Playful']);
      const loadAnimates = await page.evaluate(() => document.getAnimations().some((a) => (a.effect as KeyframeEffect).target === document.querySelector('.proto-picker-highlight')));
      rows.push(['The highlight does not animate on load', !loadAnimates]);

      const style = await picker(page).evaluate((el) => { const s = getComputedStyle(el); return [s.position, s.bottom, s.zIndex, s.borderRadius, s.backgroundColor]; });
      rows.push(['Picker styles are PICKER.md verbatim', JSON.stringify(style) === JSON.stringify(['fixed', '24px', '2147483647', '999px', 'rgba(10, 10, 10, 0.82)'])]);
      await story.screenshot({ page, alt: `Picker, ${version}`, fullPage: false });

      story.table({ label: 'Behaviour contract', columns: ['Clause', 'Holds'], rows: rows.map(([c, ok]) => [c, ok ? 'yes' : 'NO']) });
      const broken = rows.filter(([, ok]) => !ok).map(([c]) => c);
      story.then(fixed ? 'every clause holds' : 'the swap animates, typing switches variants, and the choice is lost on reload');
      expect(broken).toEqual(fixed ? [] : ['Number keys are ignored in inputs', 'The variant swap is instant', 'The choice survives a reload (?v=)']);
    });
  });
}
