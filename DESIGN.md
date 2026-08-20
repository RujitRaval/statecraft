# Design System — Statecraft Example Application

## Product Context

- **What this is:** A fictional commerce-operations product used as Statecraft's deterministic product-state fixture and primary visual proof.
- **Who it's for:** Frontend engineers, product designers, QA teams, and maintainers evaluating realistic application states.
- **Space:** Modern commerce operations and internal SaaS tooling.
- **Project type:** Data-dense responsive dashboard.

## Memorable Idea

Problems become impossible to miss. Healthy operations feel calm and exact; loading, empty, and failure states remain intentional, legible, and visually distinct.

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

## Spacing and Layout

- **Base unit:** 4 pixels.
- **Density:** Comfortable at the shell level, compact within operational data.
- **Scale:** 4, 8, 12, 16, 24, 32, 48, and 64 pixels.
- **Approach:** A disciplined twelve-column desktop grid that collapses to a single content stream below 760 pixels.
- **Maximum content width:** 1600 pixels.
- **Radius:** 0 for structural regions, 8 pixels for controls, 16 pixels for large inset surfaces, and full circles only for avatars/status dots.

## Motion

- **Approach:** Minimal and functional.
- **Durations:** 120 milliseconds for controls and 220 milliseconds for state transitions.
- **Rule:** Respect reduced motion and never animate evidence needed for deterministic screenshots.

## Decisions Log

| Date | Decision | Rationale |
| --- | --- | --- |
| 2026-08-20 | Adopt industrial-editorial operations styling | It gives the example a memorable face while keeping dense state evidence easy to inspect. |
| 2026-08-20 | Self-host one variable font | Builds remain network-independent without falling back to generic system typography. |
