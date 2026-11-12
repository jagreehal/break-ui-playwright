import { test as base, expect, type Page } from '@playwright/test';

/** Collects console errors and uncaught page errors as they happen. */
export function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(`console.error: ${m.text()} ${m.location().url}`.trim()));
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  return errors;
}

/** Fails any test whose page logs a browser error it didn't expect. A test that expects some matches them with `allowedErrors`. */
export const test = base.extend<{ allowedErrors: RegExp | undefined; failOnBrowserErrors: void }>({
  // One regex, not an array: test.use reads a two-item array as [value, options].
  allowedErrors: [undefined, { option: true }],
  failOnBrowserErrors: [
    async ({ page, allowedErrors }, use) => {
      const errors = watchErrors(page);
      await use();
      expect(errors.filter((e) => !allowedErrors?.test(e)), 'unexpected browser errors').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
export type { Page } from '@playwright/test';
