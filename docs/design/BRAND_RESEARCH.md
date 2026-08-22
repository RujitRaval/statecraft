# Statecraft Brand Research

## Purpose

Statecraft turns hidden UI states into evidence a team can act on. Its visual system must make a failed state feel impossible to ignore without turning a technical report into decoration. The product should feel like an editorial instrument: exact enough for an engineer, dramatic enough for a product review, and useful without a network connection.

## Reference research

The reference set was reviewed for transferable interaction and art-direction patterns, not surface imitation.

| Reference | Transferable lesson | Statecraft application |
| --- | --- | --- |
| [Awwwards](https://www.awwwards.com/) | Dense indexes stay legible when small metadata and large titles have a strict hierarchy. | Treat route, state, viewport, and theme as editorial coordinates around the evidence. |
| [Run Rob Run](https://www.runrobrun.com/) | Typography, sequencing, and a persistent canvas can carry the whole experience. | Make one active screenshot the dominant object instead of surrounding it with dashboard cards. |
| [Produx](https://www.produx.design/) | A brand can be felt before it is explained through scale, restraint, and cinematic pacing. | Let the report open with one oversized verdict and progressively reveal proof. |
| [Lamalama](https://lamalama.com/) | Reel-like navigation makes browsing work feel tactile and continuous. | Turn the matrix into an evidence filmstrip with an immersive detail layer. |
| [By Monolog](https://bymonolog.com/) | Texture and motion can replace ornamental containers. | Use rules, crops, offsets, and evidence movement instead of rounded card stacks. |
| [Indigo Laboratory](https://indigo-laboratory.it/) | Giant display type and mono labels can support a long editorial narrative. | Pair oversized verdict language with compact forensic metadata. |
| [Tresmares](https://www.tresmarescapital.com/en/) | Full-canvas sections and sticky story beats create momentum. | Pin filters and open evidence into a viewport-scale inspection surface. |

Additional pattern research used [Codrops demos](https://tympanus.net/codrops/demos/page/4/) and [Codrops Playground](https://tympanus.net/codrops/category/playground/) to study current editorial transitions. Motion constraints follow [WCAG animation from interactions](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions), [W3C technique C39](https://www.w3.org/WAI/WCAG21/Techniques/css/C39), and [web.dev motion guidance](https://web.dev/learn/accessibility/motion).

## Brand position

- **Promise:** Find the state that breaks before a user does.
- **Personality:** forensic, kinetic, direct, and composed under pressure.
- **Voice:** short sentences, concrete evidence, no fear marketing, no quality theater.
- **Enemy:** a green dashboard that hides weak coverage behind a pleasant average.
- **Emotional arc:** calm orientation, rising curiosity, decisive failure signal, confident diagnosis.

## Memorable mechanism: signal fracture

Healthy evidence is calm, aligned, and paper-like. Failed evidence breaks the system in controlled ways: a vermilion rule cuts across the frame, labels shift by a few pixels, and the screenshot crop gains an offset edge. The effect must never obscure the screenshot, change document order, or become an infinite animation.

Signal fracture is semantic. It appears only for failed, missing, or actively selected evidence. It is not a reusable decoration for marketing sections.

## Visual language

### Palette

- Void: `#0b0c0a`
- Ink: `#171a16`
- Bone: `#f4f0e6`
- Paper: `#fbfaf6`
- Acid signal: `#c8ff48`
- Failure vermilion: `#ff4d2e`
- Forensic cobalt: `#4c66ff`
- Muted stone: `#74786f`

Acid marks selection and healthy completion. Vermilion marks failure. Cobalt is reserved for navigation focus and neutral technical annotation. None of the accents may become a decorative gradient.

### Type

- Display direction: Instrument Serif or a high-contrast editorial serif.
- Interface direction: IBM Plex Sans Variable.
- Evidence labels: IBM Plex Mono.
- Offline report fallback: Georgia for display; system sans and system monospace for everything else. The generated report must not request a font from the network.

The display scale is intentionally extreme: `clamp(4rem, 12vw, 11rem)` for the report verdict. Labels stay between 11 and 13 pixels with strong tracking. Body text stays at 16 pixels or larger.

### Composition

- Twelve-column editorial grid above 1024 pixels.
- Full-bleed structural regions, sharp corners, and hairline rules.
- One dominant object per viewport: verdict, matrix strip, or active screenshot.
- 44-pixel minimum controls and visible focus outlines.
- Mobile collapses to one evidence stream; it never hides status or relies on hover.

## Report experience

1. **Verdict:** a viewport-scale opening names the report and makes the pass percentage unavoidable.
2. **Run tape:** route, state, execution, failure, duration, and schema facts form a single ruled strip rather than six cards.
3. **Control rail:** filters remain compact and sticky while evidence moves beneath them.
4. **Evidence field:** rectangular screenshot cells read like a contact sheet. Failed cells fracture the grid.
5. **Inspection room:** selecting a cell opens a dark, viewport-scale evidence layer with the screenshot first, metadata second, and diagnostic rows last.
6. **Return:** Escape, browser history, or the explicit close control returns focus to the originating cell.

## Motion contract

- Motion explains state change or spatial relationship; it never decorates idle time.
- Controls use 120 milliseconds. Evidence transitions use 220 milliseconds.
- No auto-playing reels, parallax, cursor replacement, or infinite text marquees in the report.
- `prefers-reduced-motion: reduce` removes transforms, smooth scrolling, and entry transitions.
- Screenshot capture remains deterministic because evidence content itself is never animated by the report.

## Accessibility and offline constraints

- Preserve semantic headings, table relationships, form labels, diagnostic disclosure controls, and useful alternative text.
- Keep keyboard focus visible against both paper and void surfaces.
- Maintain the self-contained Content Security Policy: no network scripts, styles, fonts, frames, or analytics.
- Do not use WebGL or a runtime UI dependency in the offline report. CSS and the existing pinned inline interaction script are sufficient.
- The interface must remain readable with JavaScript disabled; JavaScript enhances filtering and the inspection layer.

## Anti-patterns

- Rounded card farms, floating glass panels, and blue-purple gradients.
- Tiny screenshots used as decoration instead of evidence.
- A generic SaaS sidebar around an offline report.
- Motion that competes with failure evidence.
- Health scores without the route/state coordinates that produced them.
- Hiding diagnostics behind icons with no text label.

## Acceptance test

A first-time viewer should understand in five seconds whether the run is healthy, where the failures are, and what to open next. A failed screenshot should be visually dominant without becoming harder to inspect. The same report must work at 375, 768, 1024, and 1440 pixels, with keyboard-only navigation and reduced motion.
