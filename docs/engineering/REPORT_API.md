# Report API

`uiwitness-report` owns Phase 5's browser-independent transformation and offline HTML boundary. It depends only on `uiwitness-core`; it does not launch Playwright, discover configuration, choose exit codes, start a server, or access the network.

## Transformation

```ts
import { transformReport } from "uiwitness-report";

const view = transformReport(schemaV1Report);
```

`transformReport(input)` first delegates unknown data to the core `parseReport` contract. It then projects executions into immutable, first-seen-order viewport/theme columns, route groups, route/state rows, aligned cells, and execution detail records. Screenshot references are converted from validated `.uiwitness/artifacts/...` paths to report-relative `../artifacts/...` references. Route, state, viewport, and theme metadata always comes from execution records; the transformer never reconstructs metadata from filenames.

The public `ReportViewModel` and its `ReportColumnView`, `ReportRouteView`, `ReportRowView`, and `ReportCellView` components are renderer-ready but contain no browser or filesystem behavior. Missing coordinates remain explicit `null` cells instead of being fabricated.

## Offline HTML

```ts
import { renderReportHtml } from "uiwitness-report";

const html = renderReportHtml(schemaV1Report);
```

`renderReportHtml(input)` emits one deterministic HTML document with inline CSS and no CDN, font request, server dependency, or other network asset. The Phase 5 document includes the kinetic evidence verdict, ruled run tape, responsive route/state evidence field, screenshot frames, execution metadata, failures, console/page diagnostics, and failed requests. Every report-controlled string is HTML-escaped.

Native route/state/viewport/theme/status selects filter with AND semantics. Options follow validated first-seen execution order, and the empty wildcard value leaves every valid identifier, including `all`, available for exact filtering. Valid non-default selections are restored from and written to the local document query string, hidden viewport/theme columns retain matrix alignment, and an `aria-live` summary reports matching executions and rows. Selecting a cell opens one viewport-scale inspection room, gives it dialog semantics, contains forward and reverse Tab focus while open, marks its trigger, and supports Close, Escape, URL hashes, browser history, and focus return. Diagnostic groups use native disclosure elements with counts. A no-match state and one-click reset keep recovery obvious.

The interaction script is constant and contains no report values. Its exact SHA-256 is calculated during rendering and is the only script authorized by the document Content Security Policy; external scripts and assets remain blocked. If script execution is unavailable, ordinary cell anchors and the complete detail list remain usable as a progressive fallback.

## Publication boundary

`uiwitness-report` deliberately owns no filesystem mutation. `REPORT_HTML_PATH` exposes the stable `.uiwitness/report/index.html` project-relative contract, while the Playwright runner stages rendered HTML beside its JSON and PNG output. All three outputs publish under the runner's existing owned project lock and recovery transaction, preventing concurrent scans from mixing report generations. Existing HTML targets must be regular files, staged files use owner-only mode where supported, and a failed final HTML rename restores the previous screenshot, JSON, and HTML set.

`uiwitness scan` returns both `htmlReportPath` and the machine-readable JSON `reportPath`, and its terminal summary points to the HTML document.
