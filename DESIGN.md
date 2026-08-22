# Design System — Statecraft

## Product Context

- **What this is:** A local-first UI state evidence tool plus a fictional commerce-operations application used as its deterministic product-state fixture.
- **Who it's for:** Frontend engineers, product designers, QA teams, and maintainers evaluating realistic application states.
- **Space:** Modern commerce operations and internal SaaS tooling.
- **Project type:** Data-dense responsive dashboard.

## Memorable Idea

Problems become impossible to miss. Healthy operations feel calm and exact; loading, empty, and failure states remain intentional, legible, and visually distinct.

The Statecraft report expresses this as **signal fracture**: healthy evidence stays aligned and quiet, while failed evidence introduces a controlled vermilion cut, offset edge, or broken rule without obscuring the screenshot. See `docs/design/BRAND_RESEARCH.md` for the reference study and full experience rationale.

## Aesthetic Direction

- **Direction:** Industrial editorial.
- **Decoration:** Intentional, with fine rules, offset surfaces, restrained texture, and sharp status signals.
- **Mood:** Serious operating software with the clarity of a daily briefing, not a generic component gallery.
- **Safe choices:** Familiar side navigation, clear metrics, tabular numbers, visible status labels, and predictable responsive behavior.
- **Risks:** Warm paper surfaces instead of blue-gray SaaS chrome; asymmetric headlines; signal green used sparingly against near-black ink.

## Typography

- **Primary:** IBM Plex Sans Variable, self-hosted through `@fontsource-variable/ibm-plex-sans`.
- **Data and labels:** IBM Plex Sans with tabular numerals and increased tracking.
- **Code fallback:** `ui-monospace`, `SFMono-Regular`, `Menlo`, monospace.
- **Report display:** Instrument Serif where assets can be self-hosted; Georgia is the network-free generated-report fallback.
- **Report evidence labels:** IBM Plex Mono where assets can be self-hosted; system monospace is the generated-report fallback.
- **Scale:** 12, 14, 16, 20, 28, 40, and 64 pixels, using fluid clamps for the two largest steps.

## Color

- **Approach:** Restrained.
- **Ink:** `#171a16`.
- **Paper:** `#f2f0e9`.
- **Surface:** `#fbfaf6`.
- **Signal:** `#b8f25a` for healthy, selected, and primary-action states.
- **Secondary:** `#23634f` for positive trends and data emphasis.
- **Error:** `#c94d3f`.
- **Warning:** `#d69b2d`.
- **Muted:** `#6c7169`.
- **Dark mode:** Rebuild surfaces around `#11140f`; reduce signal saturation and retain semantic contrast.
- **Report bone:** `#f4f0e6` for the editorial evidence field.
- **Report void:** `#0b0c0a` for immersive inspection.
- **Report failure:** `#ff4d2e` for signal-fracture cuts and failed evidence.
- **Report focus:** `#4c66ff` for neutral forensic focus where signal green would imply success.

## Spacing and Layout

- **Base unit:** 4 pixels.
- **Density:** Comfortable at the shell level, compact within operational data.
- **Scale:** 4, 8, 12, 16, 24, 32, 48, and 64 pixels.
- **Approach:** A disciplined twelve-column desktop grid that collapses to a single content stream below 760 pixels.
- **Maximum content width:** 1600 pixels.
- **Radius:** 0 for structural regions, 8 pixels for controls, 16 pixels for large inset surfaces, and full circles only for avatars/status dots.
- **Report composition:** Full-bleed ruled regions and one dominant evidence object per viewport. Do not wrap the report in a dashboard shell or convert its summary into a row of floating cards.

## Motion

- **Approach:** Minimal and functional.
- **Durations:** 120 milliseconds for controls and 220 milliseconds for state transitions.
- **Rule:** Respect reduced motion and never animate evidence needed for deterministic screenshots.
- **Report rule:** No infinite motion, parallax, cursor replacement, or auto-playing reels. Movement exists only to connect a matrix cell to its inspection view.

## Decisions Log

| Date | Decision | Rationale |
| --- | --- | --- |
| 2026-08-20 | Adopt industrial-editorial operations styling | It gives the example a memorable face while keeping dense state evidence easy to inspect. |
| 2026-08-20 | Self-host one variable font | Builds remain network-independent without falling back to generic system typography. |
| 2026-08-22 | Adopt kinetic evidence editorial for reports | Full-bleed evidence, extreme type scale, and semantic signal fracture make failures memorable without weakening offline or accessibility guarantees. |
