# Report UX Specification

The report is UIWitness's primary product surface and launch asset.

## Header
Product name, "UI State Coverage Report", a viewport-scale evidence verdict, passed/expected executions, execution coverage, and generation metadata. Routes, states, executions, passed, failed, and duration form one ruled run tape rather than separate cards.

## Matrix
Rows = route/state. Columns = viewport/theme. Each available cell shows status + a large screenshot frame in a horizontally navigable evidence field. Failures use the controlled signal-fracture treatment without obscuring screenshots.

## Detail view
Selecting a cell opens a viewport-scale inspection room with the full screenshot first; route/URL, state, viewport, theme, duration, status, and scenario source second; and failures, console errors, page errors, and failed requests as ruled disclosures below.

## Filters
Route, state, viewport, theme, pass/fail.

## Constraints
Fully offline; no CDN/server/font request; bundled CSS/JS; responsive; keyboard usable; screenshots dominate; purposeful finite motion only; reduced-motion safe; full-bleed and explicitly not dashboard-heavy.

## Launch test
A report screenshot should explain UIWitness before a developer reads the README.

## Phase 5 delivery

The report includes validated transformation plus a responsive offline document with the editorial verdict, ruled run tape, evidence matrix, full evidence, metadata, failures, and counted diagnostic disclosures. Native route/state/viewport/theme/status filters combine predictably, preserve their state in the local URL, announce result counts, and provide a clear reset/no-match path. A keyboard-accessible inspection room shows one execution at a time and supports Escape, return focus, hashes, browser history, and dialog semantics while open. Inline CSS and a CSP-hashed constant script require no external asset, network request, or server. Phase 5 is complete; the kinetic evidence visual system is documented in `DESIGN.md` and `docs/design/BRAND_RESEARCH.md`.
