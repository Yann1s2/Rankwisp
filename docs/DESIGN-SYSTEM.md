# Rankwisp visual identity and interaction review

The latest user direction replaces the initial cartoon approach: minimal, refined, and
free of characters or decorative mascots. The identity uses a small abstract navy mark,
a quieter wordmark and precise, content-sized components. Existing product flows remain intact.

## Colour roles

| Colour | Role |
| --- | --- |
| `#1E1E24` | Primary text |
| `#92140C` | Main actions, errors, editorial emphasis |
| `#FFF8F0` | Warm app and website canvas |
| `#FFCF99` | Restrained trial and chart accents |
| `#111D4A` | Navigation, first metric, charts and abstract mark |

Secondary neutrals are derived for borders and quiet text. Google's familiar multicolour
mark is reserved for the Google sign-in control. No decorative gradient or glass surfaces
are used; the chart's subtle area tint represents its plotted series.

## Review and corrections

| Before | After | Why |
| --- | --- | --- |
| Large headings, page-body scrolling | Fixed app shell; bounded content regions | Navigation/actions stay available |
| Four stacked Settings cards | Keyboard-accessible Plan, Preferences, Data and Account tabs | Avoid scrolling through unrelated options |
| Mobile desktop-width keyword table | Compact labelled rows with grouping/archive controls | No horizontal swipe required to manage a keyword |
| Large competitor cards | Compact mobile comparison rows | Compare three apps together |
| Fixed 900px chart coordinates | ResizeObserver-sized SVG coordinates | Axis labels remain legible on phones |
| Cartoon mascot and decorative sparkles | Abstract navy mark and ordinary directional icons | Follow the user’s revised minimalist direction |
| Tall peach guidance card | Neutral panel sized to its content; compact mobile strip | Removes unnecessary visual weight and empty space |
| Offset card and button shadows | Thin borders and flat surfaces | Calmer visual hierarchy |
| Registration-first screen | Google-first, email only where supported | Reduce unnecessary forms |
| Hidden off-canvas links keyboard-focusable | Hidden closed drawer, focus trap and Escape | Predictable keyboard navigation |
| Short desktop overview clipped rows | Adaptive chart; summary table omitted below 850px, full data in Keywords | No clipped content |
| Tiny-phone demo badge disappeared | Short persistent “Demo · fictional data” badge | Illustrations remain honestly labelled |

## Verification

Reviewed overview, keyword management, history, comparisons, ideas, Settings and auth in a
real Chromium browser. Captured website and mobile/desktop app screenshots in `screenshots`.
Desktop 1440×900 overview: body 900/900px, main 810/810px (no scroll overflow).
Desktop 1440×800 after correction: body 800/800px, main 710/710px.
Small phone 375×667 overview: body 667/667px, main 525/525px; no horizontal document overflow.
390×844 keyword screen has no horizontal document overflow; management rows expose controls.
Settings arrow-key navigation moved Preferences → Your data → Account correctly.
Final automated layout sweep passed all six views at 375×667, 390×844, 844×390,
768×1024 and 1440×800, including wheel attempts without document scrolling.
A landscape comparison overflow was traced to absolutely positioned screen-reader text
escaping its scroll container; the workspace now establishes its containing block.
Axe WCAG A/AA checks passed with zero serious/critical findings for website, auth and
overview with reduced motion enabled (avoiding transient entry-animation contrast readings).
Marketing preview footnotes and platform text now use the readable muted token.

Scrollable history and long lists remain scrollable intentionally. Layout reserves safe areas,
uses visualViewport for keyboard resizing, keeps mobile navigation anchored, and respects
Reduce Motion. Native-device keyboard/VoiceOver and full real Google authorization are separate
integration checks; visual browser inspection does not claim those passed.

## Minimal revision verification

All six primary views reviewed again on desktop and mobile. The replacement mark is used
in the wordmark and authentication card; no mascot image or sparkle icon remains in the UI.
Browser suite passed 7/7, including all 30 viewport/view combinations and serious/critical
accessibility checks. Screenshots are in `work/production/minimal-*.png`.

## Editable keyword suggestions

Onboarding and keyword management share one compact suggestion component. Generating ideas
requires the existing explicit OpenAI consent and a configured provider. Every returned term
is editable and selectable; “Use selected” appends to the current draft, preserving manual
wording and filtering Unicode-equivalent duplicates. Only the existing final save action
adds keywords. Availability, budget and provider errors leave manual entry usable. The UI
shows the actual returned model, and never labels fallback/manual data as AI output.

The website navigation links to GitHub; its footer identifies the MIT-licensed open source
repository. Settings → Account provides the same repository link alongside support.

Verification: ten browser tests passed, including both feature surfaces, consent gating,
manual-draft preservation, explicit save, provider-unavailable paths and modal accessibility.
A final targeted test also verifies NFKC duplicate handling. Fixture screenshots are
`screenshots/keyword-suggestions-desktop.png` and `screenshots/keyword-suggestions-mobile.png`;
they demonstrate interaction with synthetic responses, not a live AI generation claim.
