import type { Page } from '@playwright/test';

/** break-ui's failure signature table (skills/break-ui/SKILL.md, Phase 4), keyed so tests can name what they expect. */
export const SIGNATURES = {
  'avatar-squished': ['Ugly', 'Avatar or icon squished into an oval', '`flex-shrink: 0` on the avatar'],
  'text-overflows': ['Broken', 'Text overflows its box', '`min-width: 0` on the text column'],
  'email-past-edge': ['Broken', 'Email or URL runs past the edge', '`overflow-wrap: anywhere`'],
  'action-unreachable': ['Broken', 'Trailing action hidden, clipped or covered', '`min-width: 0` on the middle, `flex-shrink: 0` on the action'],
  'action-wrong-side': ['Ugly', 'Trailing action on the wrong side in RTL', 'Logical properties (`margin-inline-start: auto`)'],
  'badge-wraps': ['Ugly', 'Badge wraps onto two lines', '`white-space: nowrap; flex-shrink: 0` on the badge'],
  'avatar-adrift': ['Ugly', 'Avatar centred against multi-line text', '`align-items: flex-start`'],
  'clipped': ['Broken', 'Content cut off by a fixed height', '`min-height` instead of `height`, no `overflow: hidden`'],
  'word-break-all': ['Ugly', 'Heading breaks mid-word', '`overflow-wrap: anywhere` instead of `word-break: break-all`'],
  'wrong-initials': ['Ugly', 'Wrong initials (half an emoji, "CI", "undefined")', 'Initials from grapheme clusters (`Intl.Segmenter`), first + last word'],
  'orphan-placeholder': ['Ugly', 'Orphaned "—" where an optional field was', 'Omit the line'],
  'wrong-plural': ['Ugly', '"1 members", "1 days ago"', '`Intl.PluralRules`'],
  'proportional-figures': ['Fragile', 'Counts use proportional figures and jitter on update', '`font-variant-numeric: tabular-nums`'],
  'raw-number': ['Ugly', '`1284`, `NaN`, `null`, `undefined` shown raw', '`Intl.NumberFormat`; guard null'],
  'button-overflows': ['Broken', 'Translated button label cut off', '`min-width` instead of a fixed `width`'],
  'tight-line-height': ['Ugly', 'Diacritics clipped by tight line-height + overflow hidden', 'Looser `line-height`, no clipping on text'],
  'broken-image': ['Broken', 'Broken-image icon in the avatar', '`onerror` fallback to initials'],
  'image-distorted': ['Ugly', 'Avatar image stretched', '`object-fit: cover`'],
  'truncated-unreadable': ['Fragile', 'Truncated text with no way to read it', '`title` or tooltip with the full value'],
  'all-rows-rendered': ['Broken', '1,000 rows rendered at once', 'Paginate or virtualize'],
  'markup-from-data': ['Broken', 'Markup or entities from data rendered as HTML', 'Escape once, at render'],
  'low-contrast': ['Broken', 'Text unreadable against its background', 'Colour tokens per colour scheme'],
  'lines-too-long': ['Ugly', 'Rows stretched across a very wide screen', '`max-width` on the list'],
  'bad-relative-time': ['Ugly', '"0 days ago", "-3 days ago", 1970 shown as a date', '`Intl.RelativeTimeFormat`, absolute date after a week, "Never" for no date'],
  'tag-wall': ['Ugly', 'Twelve tags wrap into a wall', 'Show 3, then "+N"'],
  'newline-in-field': ['Ugly', 'Newline in a single-line field', 'Collapse whitespace'],
} as const;

export type Signature = keyof typeof SIGNATURES;
export type Finding = { signature: Signature; where: string };

/** Measures the rendered page for every signature above. The toggle bar is chrome and is skipped. */
export function findBreaks(page: Page): Promise<Finding[]> {
  return page.evaluate(() => {
    const out: { signature: string; where: string }[] = [];
    const seen = new Map<Element, Set<string>>(); // one finding per signature per element
    const add = (signature: string, el: Element) => {
      const s = seen.get(el) ?? seen.set(el, new Set()).get(el)!;
      if (s.has(signature)) return;
      s.add(signature);
      out.push({ signature, where: `.${el.className || el.tagName.toLowerCase()} "${(el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 24)}"` });
    };
    const rect = (el: Element) => el.getBoundingClientRect();
    const css = (el: Element) => getComputedStyle(el);
    const hoverNone = matchMedia('(hover: none)').matches;
    const rows = [...document.querySelectorAll('li.member')];
    const all = [...document.querySelectorAll('#app *')];

    for (const row of rows) {
      const r = rect(row);
      const avatar = row.querySelector('.avatar');
      const text = row.querySelector('.text');
      const menu = row.querySelector('.menu');
      if (avatar && Math.abs(rect(avatar).width - rect(avatar).height) > 1) add('avatar-squished', avatar);
      if (avatar && text && rect(text).height > rect(avatar).height * 2 && rect(avatar).top - rect(text).top > 4) add('avatar-adrift', avatar);
      for (const el of row.querySelectorAll('*')) {
        const e = rect(el);
        if (e.width === 0 || el === menu) continue;
        if (e.right > r.right + 1 || e.left < r.left - 1) add(el.classList.contains('email') ? 'email-past-edge' : 'text-overflows', el);
      }
      if (row.scrollHeight > row.clientHeight + 1 && css(row).overflowY === 'hidden') add('clipped', row);
      if (menu) {
        const m = rect(menu);
        const covered = text && m.left < rect(text).right && m.right > rect(text).left;
        if (text && css(row).direction === 'rtl' && m.left > rect(text).left) add('action-wrong-side', menu);
        if (m.right > innerWidth || m.left < 0 || covered || (hoverNone && css(menu).opacity === '0')) add('action-unreachable', menu);
      }
      const badge = row.querySelector('.badge');
      if (badge && rect(badge).height > parseFloat(css(badge).fontSize) * 2.2) add('badge-wraps', badge);
      const initials = avatar?.textContent?.trim() ?? '';
      if (initials && (/[\uD800-\uDFFF]|�|undefined/.test(initials) || /\p{Ll}/u.test(initials))) add('wrong-initials', avatar!);
      const tags = row.querySelector('.tags, .meta');
      if (tags && row.querySelectorAll('.tag').length > 6) add('tag-wall', tags);
      for (const img of row.querySelectorAll('img')) {
        if (img.complete && img.naturalWidth === 0) add('broken-image', img);
        else if (img.naturalWidth && Math.abs(img.naturalWidth / img.naturalHeight - rect(img).width / rect(img).height) > 0.05 && !['cover', 'contain'].includes(css(img).objectFit)) add('image-distorted', img);
      }
      if (/\n/.test((row.querySelector('.role, .name') as HTMLElement | null)?.innerText.trim() ?? '')) add('newline-in-field', row);
    }

    for (const el of all) {
      const s = css(el);
      const own = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim();
      if (el.matches('h1, h2, h3') && s.wordBreak === 'break-all' && rect(el).height > parseFloat(s.fontSize) * 2) add('word-break-all', el);
      if (own === '—') add('orphan-placeholder', el);
      if (el.matches('button') && el.scrollWidth > el.clientWidth + 1) add('button-overflows', el);
      if (own && s.overflow === 'hidden' && parseFloat(s.lineHeight) < parseFloat(s.fontSize) * 1.2) add('tight-line-height', el);
      if (s.textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth + 1 && !el.closest('[title]')) add('truncated-unreadable', el);
      if (el.matches('.count') && own && !s.fontVariantNumeric.includes('tabular-nums')) add('proportional-figures', el);
      if (el.matches('b, script, i, strong')) add('markup-from-data', el);
      if (/&amp;|&lt;/.test(own)) add('markup-from-data', el);
      if (/(?<![\d,.])1 (members|projects|days|hours)\b/.test(own)) add('wrong-plural', el);
      if (/(?<!, )\b\d{4,}\b|NaN|undefined|null/.test(own) && !el.matches('.email, .tag')) add('raw-number', el);
      if (/\b0 (days|hours|seconds) ago|-\d+ \w+ ago|1970|\d{5,} days/.test(own)) add('bad-relative-time', el);
      if (own && el.matches('#app *:not(.toggle *)')) {
        const ratio = contrast(s.color, background(el));
        if (ratio < 4.5 && s.opacity !== '0') add('low-contrast', el);
      }
    }
    if (rows.length > 200) add('all-rows-rendered', document.querySelector('#members')!);
    const list = document.querySelector('#members');
    if (list && rect(list).width > 1600) add('lines-too-long', list);

    function background(el: Element | null): string {
      for (; el; el = el.parentElement) {
        const bg = css(el).backgroundColor;
        if (bg && !/rgba\(.*, 0\)|transparent/.test(bg)) return bg;
      }
      return 'rgb(255, 255, 255)';
    }
    function contrast(a: string, b: string) {
      const lum = (c: string) => {
        const [r, g, bl] = c.match(/[\d.]+/g)!.slice(0, 3).map(Number).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
        return 0.2126 * r! + 0.7152 * g! + 0.0722 * bl!;
      };
      const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
      return (x! + 0.05) / (y! + 0.05);
    }
    return out;
  }) as Promise<Finding[]>;
}
