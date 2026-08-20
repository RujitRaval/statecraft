# ADR 0019: Deterministic offline report foundation

## Status

Accepted

## Context

Phase 5 must turn the existing schema-v1 JSON and deterministic screenshots into Statecraft's primary product surface without adding a server, network dependency, browser runtime, or duplicate execution semantics. The first slice must also close the CLI's remaining scan-to-report handoff while leaving richer filtering interaction independently reviewable.

## Decision

- Add the real `@statecraft/report` workspace package with no external runtime dependency beyond `@statecraft/core`.
- Validate unknown report input through `parseReport`, then derive ordered matrix columns, route/state rows, cells, and detail records only from explicit execution metadata.
- Render a responsive, keyboard-reachable baseline report as one HTML document with inline CSS, no JavaScript, and relative references to the already-persisted PNG artifacts.
- Escape every report-controlled string and set a restrictive document Content Security Policy. Do not load external fonts, styles, scripts, images, or telemetry.
- Publish `.statecraft/report/index.html` through a validated real-directory boundary and an owner-private temporary file followed by atomic rename.
- Have CLI scan invoke report publication after runner persistence, return both HTML and JSON paths, and point terminal users to the HTML report.
- Defer interactive filters and the final detail-view polish to the next Phase 5 slice.

## Consequences

Every completed scan now produces a directly inspectable offline report that `statecraft open` can launch, while the core JSON contract and Playwright runner remain independently testable. The transformation API creates a stable seam for later UI interaction without adopting React or a bundler. The generated HTML intentionally duplicates its presentation markup rather than requiring a runtime script; richer filtering will add narrowly scoped embedded behavior in a later slice.
