import { test, expect, type Page } from './lib/test';
import { settle } from './lib/motion';
import { story } from 'executable-stories-playwright';

story.feature({
  title: 'ask-sonner: the troubleshooting table, in a real Sonner app',
  narrative:
    'skills/ask-sonner lists the symptoms people hit with Sonner. toast.jsx reproduces four of them before the fixes (two Toasters, a Toaster ' +
    'trapped under a dialog, the default light theme in dark mode, a toast.promise that never settles) and applies the skill\'s fix for each after.',
  tags: ['ask-sonner'],
});

const open = (page: Page, fixed: boolean) => page.goto(`/toast.html${fixed ? '?fixed' : ''}`);
const toasts = (page: Page, text: string) => page.locator('[data-sonner-toast]', { hasText: text });

for (const fixed of [false, true]) {
  const version = fixed ? 'after the fixes' : 'before the fixes';
  const pair = fixed ? 'good (after the fixes)' : 'bad (before the fixes)';
  test(`a toast appears once: ${pair}`, async ({ page }, testInfo) => {
    story.init(testInfo);
    story.given(`the settings page, ${version}`);
    await open(page, fixed);
    story.when('Save is pressed');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(toasts(page, 'Settings saved').first()).toBeVisible();
    await story.screenshot({ page, alt: `Saved, ${version}`, fullPage: false });
    story.then(fixed ? 'one toast, from the one root Toaster' : 'two identical toasts: the layout and the page each mount a Toaster');
    await expect(toasts(page, 'Settings saved')).toHaveCount(fixed ? 1 : 2);
  });
}

for (const fixed of [false, true]) {
  const version = fixed ? 'after the fixes' : 'before the fixes';
  const pair = fixed ? 'good (after the fixes)' : 'bad (before the fixes)';
  test(`a toast shows above an open dialog: ${pair}`, async ({ page }, testInfo) => {
    story.init(testInfo);
    story.given(`the Share dialog is open, ${version}`);
    await open(page, fixed);
    await page.getByRole('button', { name: 'Share' }).click();
    story.when('Copy link is pressed');
    await page.getByRole('button', { name: 'Copy link' }).click();
    const toast = toasts(page, 'Link copied').first();
    await expect(toast).toBeVisible();
    await settle(toast);
    await story.screenshot({ page, alt: `Link copied over the dialog, ${version}`, fullPage: false });
    const onTop = await toast.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return !!document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.closest('[data-sonner-toast]');
    });
    story.then(fixed ? 'the toast is the top element where it is drawn' : 'the dialog overlay covers it: the Toaster is inside a transformed, low z-index wrapper');
    expect(onTop).toBe(fixed);
  });
}

for (const fixed of [false, true]) {
  const version = fixed ? 'after the fixes' : 'before the fixes';
  const pair = fixed ? 'good (after the fixes)' : 'bad (before the fixes)';
  test(`dark mode and rich colours: ${pair}`, async ({ page }, testInfo) => {
    story.init(testInfo);
    await page.emulateMedia({ colorScheme: 'dark' });
    story.given(`the system is in dark mode, ${version}`);
    await open(page, fixed);
    await page.getByRole('button', { name: 'Save' }).click();
    const toast = toasts(page, 'Settings saved').first();
    await expect(toast).toBeVisible();
    await settle(toast);
    await story.screenshot({ page, alt: `Dark mode, ${version}`, fullPage: false });
    const [bg, rich] = await toast.evaluate((el) => [getComputedStyle(el).backgroundColor, el.getAttribute('data-rich-colors')]);
    const light = bg.match(/\d+/g)!.slice(0, 3).map(Number).reduce((a, b) => a + b, 0) > 384;
    story.kv({ label: 'Toast background, data-rich-colors', value: [bg, rich] });
    story.then(fixed ? 'a dark, green success toast (theme="system", richColors)' : 'a white, grey toast: theme defaults to light, and success is grey without richColors');
    expect(light).toBe(!fixed);
    expect(rich === 'true').toBe(fixed);
  });
}

for (const fixed of [false, true]) {
  const version = fixed ? 'after the fixes' : 'before the fixes';
  const pair = fixed ? 'good (after the fixes)' : 'bad (before the fixes)';
  test(`toast.promise moves from loading to success: ${pair}`, async ({ page }, testInfo) => {
    story.init(testInfo);
    story.given(`the settings page, ${version}`);
    await open(page, fixed);
    story.when('Upload is pressed');
    await page.getByRole('button', { name: 'Upload' }).click();
    await expect(toasts(page, 'Uploading').first()).toBeVisible();
    // A fixed wait on purpose: the claim is that it is still loading 1.5s later.
    await page.waitForTimeout(1500);
    await story.screenshot({ page, alt: `1.5s later, ${version}`, fullPage: false });
    story.then(fixed ? 'it settles to "Uploaded"' : 'it is stuck on "Uploading…": the promise never settles');
    await expect(toasts(page, 'Uploaded').first()).toBeVisible({ visible: fixed });
  });
}

test('swipe a toast away: good (after the fixes) only', async ({ page }, testInfo) => {
  story.init(testInfo);
  story.given('a toast in the bottom-right corner');
  await open(page, true);
  await page.getByRole('button', { name: 'Save' }).click();
  const toast = toasts(page, 'Settings saved');
  await expect(toast).toBeVisible();
  await settle(toast);
  const box = (await toast.boundingBox())!;
  story.when('it is dragged down, the direction its position allows');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 80, { steps: 8 });
  await story.screenshot({ page, alt: 'Mid-swipe', fullPage: false });
  await page.mouse.up();
  story.then('it is dismissed');
  await expect(toast).toHaveCount(0);
});
