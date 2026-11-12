# Emil Kowalski's UI skills, tested with Playwright

[emilkowalski/skills](https://github.com/emilkowalski/skills) teaches your agent the small details that make an
interface feel right: easing, timing, gestures, mobile polish, and pages that hold up under worst-case data. This repo
gives each web skill a demo page with the mistakes it exists to catch, then lets Playwright run the skill's own
workflow against it. You can watch every skill find the problems on the before page and sign off on the fixed one.

It also answers a practical question: your agent doesn't need a live Chrome tab to use these skills. Playwright
covers the screenshots, slow motion, dark mode, touch and screen sizes the skills ask for, and each check stays as
a test you can re-run. The skills are copied into `skills/` unchanged (MIT, see `skills/LICENSE`).

**[See the latest report](https://jagreehal.github.io/break-ui-playwright/)**

Every web skill has a demo page in `app/` in two versions: the problems the skill exists to catch (the default) and
the skill's own fixes (`?fixed`). Each test does what the skill's workflow says, then measures the result and takes
screenshots. On the before version the test must find the problems. If it finds none, Playwright missed them. On
the after version it must find none. All 132 tests pass on both versions.

```sh
pnpm install && pnpm exec playwright install chromium
pnpm test        # 132 tests, ~15s, writes reports/index.html
pnpm report      # every case with its screenshots and the skill's report tables
pnpm start       # the demo pages at http://localhost:4377 (add ?fixed for the after version)
pnpm typecheck
```

`pnpm test` writes `reports/index.html`. Commit it and push, and `.github/workflows/pages.yml` publishes it to GitHub
Pages.

## Coverage

| Skill | Page | What the tests do | Playwright features used |
|---|---|---|---|
| [**break-ui**](https://aiforui.dev/skills/break-ui) | `members.html` | Phase 1 field map. Phase 2: worst case, demo, one, 1,000 rows, empty, API error, slow API. Phase 3: the Demo / Worst case toggle (state kept in the URL, data swapped at the API). Phase 4: 1280px, 320px, 2560px, text at 200%, dark mode, RTL, touch. Measures 26 kinds of break (the skill's failure signatures plus the catalog's environment checks) and outputs its "Part 1: what broke" table. | `page.route`, `clock.setFixedTime`, `setViewportSize`, `emulateMedia`, `addInitScript`, touch contexts, DOM measurement |
| [**mobile-native**](https://aiforui.dev/skills/mobile-native) | `mobile.html` | The 11 rows of the symptom table plus keyboard hints, read from meta tags, computed styles and stylesheet rules. Sticky hover checked with a real tap, press feedback on pointer-down, `theme-color` against the header in light and dark. Also lists what only a phone can prove. | Phone emulation (`isMobile`, `hasTouch`), `tap()`, CSSOM |
| [**review-animations**](https://aiforui.dev/skills/review-animations) | `motion.html` | Standards 1 to 10 and the escalation triggers: `transition: all`, `scale(0)`, `ease-in`, weak easing, over 300ms, `transform-origin`, keyboard-triggered motion, keyframes on rapidly triggered elements, layout properties, ungated hover, reduced motion, asymmetric timing, stagger | `document.getAnimations()`, CDP `Animation.setPlaybackRate` (slow motion), paused frame-by-frame screenshots |
| [**animate**](https://aiforui.dev/skills/animate), [**emil-design-eng**](https://aiforui.dev/skills/emil-design-eng) | `motion.html` | The "Never Ship" table and the review checklist, using the same checks as review-animations, plus `:active` press feedback at 0.97 | as above |
| [**animation-performance**](https://aiforui.dev/skills/animation-performance) | `motion.html` | Phase 1 inventory (element, driver, properties). Width vs transform measured as layouts per animation (before: more than 5, after: at most 3) | CDP `Performance.getMetrics` (LayoutCount) |
| [**choreograph**](https://aiforui.dev/skills/choreograph) | `motion.html` | Part 1 timeline table. Stagger gaps (before: all at once, after: 50ms). Decoration fades only. | `getAnimations()` delays and keyframes |
| [**remove-animations**](https://aiforui.dev/skills/remove-animations) | `motion.html` | Infinite loop removed (and the element stays visible: the removal hazard check), hover lift reduced to a colour change, keyboard animation deleted | `getAnimations()` |
| [**find-animation-opportunities**](https://aiforui.dev/skills/find-animation-opportunities) | `motion.html` | The occasional modal that opens with no motion is found as an opportunity; after the fix it has a 200ms ease-out | `getAnimations()` |
| [**improve-animations**](https://aiforui.dev/skills/improve-animations) | `motion.html` | The whole-page audit: every interaction triggered, everything that animates in one table, findings counted (before: more than 10, after: 0) | `getAnimations()` |
| [**gestures**](https://aiforui.dev/skills/gestures) | `sheet.html` | 1:1 tracking, transform on the element (not a CSS variable on the parent), rubber-banding, dismiss on distance or velocity, fast snap-back, catching it mid-close, 44px hit target, `touch-action`, feedback on pointer-down, a second finger ignored, reduced motion | `page.mouse` pointer events, CDP `Input.dispatchTouchEvent` (two fingers), slow motion |
| [**apple-design**](https://aiforui.dev/skills/apple-design) | `sheet.html`, `motion.html` | Response on pointer-down, direct manipulation, interruptibility, rubber-banding, reduced motion as a fade | as above |
| [**ask-sonner**](https://aiforui.dev/skills/ask-sonner) | `toast.html` (real Sonner 2 + React) | The troubleshooting table: toast shown twice (two Toasters), toast behind a dialog (Toaster in a transformed wrapper), dark mode ignored, grey success without `richColors`, `toast.promise` stuck on loading. Also swipe to dismiss. | `elementFromPoint`, `emulateMedia`, mouse drag |
| [**prototype**](https://aiforui.dev/skills/prototype) | `prototype.html` (picker copied verbatim from PICKER.md) | Phase 5: every variant renders, every button responds, console clean, a screenshot of each. The full picker contract: one active item, number keys and arrows, keys ignored in inputs and with modifiers, instant swap, R re-mounts, `?v=` survives a reload, no animation on load, verbatim styles. | `console` / `pageerror` listeners, keyboard, reload |
| **Every page** | all six, in light and dark, at desktop and phone size | Checks that apply to any page: no sideways scrolling, and every visible line of text meets WCAG AA contrast (4.5:1). Catches fixes that only work in one theme or at one width. Before the fixes, members and mobile fail contrast in dark mode. | `browser.newContext({ colorScheme, isMobile })`, computed colours |
| [**write-swift**](https://github.com/emilkowalski/skills/tree/main/write-swift), [**animate-expo**](https://aiforui.dev/skills/animate-expo) | none | Swift and React Native. No web browser is involved, so neither Chrome nor Playwright has anything to add. | |
| [**animation-vocabulary**](https://aiforui.dev/skills/animation-vocabulary), [**pick-ui-library**](https://aiforui.dev/skills/pick-ui-library) | none | A glossary and a library chooser. They answer questions; there is no UI to drive. | |

## What this shows

Playwright ran each web skill's workflow and caught every before version. The skills ask for screenshots,
slow motion, frame-by-frame inspection, several screen sizes, dark mode, RTL, reduced motion, touch and the console.
Playwright does all of these. It measures the result, so nobody has to eyeball a screenshot, and each check stays
as a test you can run in CI and re-run after a fix. Two things go beyond what a connected Chrome tab gives you:

- **Numbers.** Overflow, contrast, animation duration, easing, delay, transform origin, layout
  count and drag position come back as numbers, so a test fails when a value is wrong.
- **Conditions you can't set up by hand.** A pinned clock, an API returning 500 or loading slowly, 1,000 rows,
  animations at 1/20 speed, an animation paused at 25% and screenshotted, two fingers on the screen at once.

The light/dark and phone matrix also caught problems in this repo's own pages, and one in Sonner. I fixed all three:

- The mobile page's carousel cards had light text on a light card in dark mode (1.1:1).
- The prototype page's subtitle grey was 4.4:1.
- Sonner's default `richColors` success text is 4.3:1 in light mode. `toast.html` darkens it with Sonner's
  `--success-text` variable.

## Limits

- **Real hardware.** mobile-native and gestures both say emulation is not a phone, and the same goes for
  Claude in Chrome. Input zoom, URL bar height, safe-area insets, rubber-banding, the software keyboard and 120Hz feel
  need a device. The mobile-native test lists each of these with the declaration it checked instead.
- **Holding a finger down.** A synthetic touch from CDP never reaches Chrome's tap gesture, so `:active` can't be
  held that way. Press feedback is checked on pointer-down instead. The real-tap test is still what catches sticky
  hover.
- **Feel.** Detail-level judgement, like whether a spring feels right or a crossfade needs blur, belongs to the
  skill's review. What the tests prove is that the values the skill specifies are the values that run.
- **Claude in Chrome is still the better fit** for exploring in your own logged-in session on real data, with no
  setup. To break a UI on purpose and prove the fixes, Playwright is enough, and you get the same result every run.

## Layout

```
skills/            the skills, unmodified
app/               one demo page per skill group; fixtures.js is break-ui's datasets and field map
server.mjs         serves app/ and /api/members (break-ui's data boundary)
tests/lib/         break-ui.ts (failure signatures), motion.ts (animation inventory and review rules),
                   test.ts (fails any test whose page logs an unexpected browser error), report.ts (report tables)
tests/*.spec.ts    one spec per skill group, before and after
```

## Credits

The skills, and the rules every test checks, come from [emilkowalski/skills](https://github.com/emilkowalski/skills)
by [Emil Kowalski](https://emilkowal.ski). Each skill's page at [aiforui.dev/skills](https://aiforui.dev/skills)
shows when to use it, an example result, and prompts to try. To install them in your own agent:

```sh
npx skills@latest add emilkowalski/skills
```
