# Report UX Specification

The report is Statecraft's primary product surface and launch asset.

## Header
Product name, "UI State Coverage Report", passed/expected executions, execution coverage, generation metadata, and cards for routes, states, executions, passed, failed, duration.

## Matrix
Rows = route/state. Columns = viewport/theme. Each available cell shows status + screenshot thumbnail. Failures are obvious without overwhelming screenshots.

## Detail view
Full screenshot; route/URL; state; viewport; theme; duration; status; scenario source; console errors; page errors; failed requests.

## Filters
Route, state, viewport, theme, pass/fail.

## Constraints
Fully offline; no CDN/server; bundled CSS/JS; responsive; keyboard usable; screenshots dominate; minimal animation; polished, not dashboard-heavy.

## Launch test
A report screenshot should explain Statecraft before a developer reads the README.

## Current Phase 5 boundary

The first slice implements validated report transformation plus a responsive offline document with the header, summary cards, matrix thumbnails, linked full evidence, metadata, failures, and diagnostics. It uses inline CSS, no runtime script or external assets, ordinary keyboard-reachable links, and a restrictive document Content Security Policy. Interactive filters and final detail-view/launch polish remain focused follow-up slices before the Phase 5 gate is complete.
