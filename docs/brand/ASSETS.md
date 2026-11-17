# Rankwisp chart identity

The latest user direction replaces the abstract organic mark with a clear analytics
chart. The current mark is original geometric SVG artwork: a rounded baseline, a
three-segment rising path, a restrained underfill and one observation point. It has
no plant silhouette, face, limbs or mascot.

The active colours come directly from the original Rankblick `Theme.swift`: ink
`#2B2D42`, slate `#8D99AE`, paper `#EDF2F4`, red `#EF233C`, crimson `#D80032`.
The original Rankblick source and existing data were only read, never modified.

Current editable sources:

- `app/public/brand/symbol.svg` — transparent ink mark with slate underfill and red point.
- `app/public/brand/app-icon.svg` — opaque ink icon with paper path and red point.

`node scripts/assets.mjs --native` deterministically exports the website symbol,
favicon, social image, 1024×1024 opaque iOS icon and native splash screens. The operating
system supplies the app icon's outer mask. Website and app share the same geometry.
The logo is included under the repository's MIT license.

The earlier Imagegen concepts below are archived for provenance only. Their original
PNGs remain in this directory and are no longer production inputs.

## Archived abstract-wisp concept prompt

Use case: logo-brand. Asset type: final standalone brand symbol for Rankwisp, a premium
app for App Store visibility research. Create one exceptionally refined MINIMALIST icon
mark, no wordmark and no text. Design an original compact abstract lowercase-r / rising
wisp symbol from two or three bold, precise, softly curved geometric shapes. It should
suggest a small upward current through its silhouette and negative space, without a
literal arrow, chart, magnifier or rocket. Strong distinctive silhouette readable at
20 px, Swiss editorial restraint, confident premium software identity. Use ONLY solid
deep navy #111D4A for the mark, with completely transparent surrounding background.
Flat vector-like crisp edges, professionally optical-balanced shape, generous clean
negative space, centered square composition, symbol occupies about 70% of canvas.
NO cartoon, NO face, NO eyes, NO person, NO limbs, NO sparkles, NO lettering, NO border,
NO gradients, NO shadow, NO texture, NO mockup, NO presentation sheet. One single
resolved symbol only. The previous cartoon identity was rejected as ugly and amateurish;
this new symbol must be simple and visually sophisticated.

## Final app-icon prompt

Use case: precise-object-edit, logo-brand. Make the production iOS app-icon colorway
of this exact minimal Rankwisp symbol. Preserve its silhouette and inner negative-space
cut precisely. The symbol must be a single perfectly uniform solid warm cream #FFF8F0,
no gradients or shading. Put it centered on a perfectly uniform solid deep navy #111D4A
square background that fills the entire canvas. Symbol width about 61% of canvas and
height about 64%, with optically balanced generous margins. No rounded corners on the
outer square, the operating system will mask them. Crisp flat graphic edges. No
highlights, texture, shadows, border, new elements, face, cartoon or text. This is an
app icon asset, not a mockup. Exact source shape, premium minimal appearance.

The source files contain the actual generated artwork. Prompt color/style instructions
are creative specifications, not a claim that each raster pixel has an exact hex value.
These archived prompts describe the superseded concept and its old colours. Current
UI tokens and production assets use the original Rankblick palette documented above.
