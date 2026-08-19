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
