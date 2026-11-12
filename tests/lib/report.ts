import type { Page } from '@playwright/test';
import { story } from 'executable-stories-playwright';

/**
 * A whole-page screenshot with fixed bars at the bottom of the page. Playwright's fullPage capture leaves them where
 * the window's bottom was, on top of the content, so this makes the window as tall as the page instead.
 * Only for pages with nothing sized in vh: the taller window would stretch it.
 */
export async function wholePage(page: Page, alt: string) {
  const size = page.viewportSize()!;
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  await page.setViewportSize({ width: size.width, height: Math.max(height, size.height) });
  await story.screenshot({ page, alt });
  await page.setViewportSize(size);
}

const cell = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\|/g, '\\|').replace(/\s+/g, ' ');

/** A summary table (one row per kind) with every finding in a collapsed <details> underneath. */
export function summarise(label: string, items: { kind: string; where: string }[], extra: (kind: string) => string[] = () => [], extraColumns: string[] = []) {
  if (!items.length) {
    story.note(`${label}: nothing found`);
    return;
  }
  const kinds = [...new Set(items.map((i) => i.kind))];
  story.table({
    label,
    columns: [...extraColumns.slice(0, 1), 'Kind', 'Count', 'Example', ...extraColumns.slice(1)],
    rows: kinds.map((k) => {
      const [first, ...rest] = extra(k);
      const of = items.filter((i) => i.kind === k);
      return [...(first === undefined ? [] : [first]), k, String(of.length), of[0]!.where, ...rest];
    }),
  });
  const md = ['| Kind | Where |', '|---|---|', ...items.map((i) => `| ${cell(i.kind)} | ${cell(i.where)} |`)].join('\n');
  story.section({ title: `Every finding (${items.length})`, markdown: `<details><summary>Show all ${items.length}</summary>\n\n${md}\n\n</details>` });
}
