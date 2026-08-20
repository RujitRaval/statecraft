# Report API

`@statecraft/report` owns Phase 5's browser-independent transformation and offline HTML boundary. It depends only on `@statecraft/core`; it does not launch Playwright, discover configuration, choose exit codes, start a server, or access the network.

## Transformation

```ts
import { transformReport } from "@statecraft/report";

const view = transformReport(schemaV1Report);
```

`transformReport(input)` first delegates unknown data to the core `parseReport` contract. It then projects executions into immutable, first-seen-order viewport/theme columns, route groups, route/state rows, aligned cells, and execution detail records. Screenshot references are converted from validated `.statecraft/artifacts/...` paths to report-relative `../artifacts/...` references. Route, state, viewport, and theme metadata always comes from execution records; the transformer never reconstructs metadata from filenames.

The public `ReportViewModel` and its `ReportColumnView`, `ReportRouteView`, `ReportRowView`, and `ReportCellView` components are renderer-ready but contain no browser or filesystem behavior. Missing coordinates remain explicit `null` cells instead of being fabricated.

## Offline HTML

```ts
import { renderReportHtml } from "@statecraft/report";

const html = renderReportHtml(schemaV1Report);
```

`renderReportHtml(input)` emits one deterministic HTML document with inline CSS and no script, CDN, font request, server dependency, or other network asset. The baseline Phase 5 document includes the product header, execution coverage, summary metrics, responsive route/state matrix, screenshot thumbnails, linked full evidence, execution metadata, failures, console/page diagnostics, and failed requests. Every report-controlled string is HTML-escaped. A restrictive document Content Security Policy permits only same-origin/data images and inline styles.

The current no-script details use ordinary anchors and visible focus states. Interactive route/state/viewport/theme/status filters and a denser detail interaction remain the next Phase 5 slice.

## Publication boundary

`@statecraft/report` deliberately owns no filesystem mutation. `REPORT_HTML_PATH` exposes the stable `.statecraft/report/index.html` project-relative contract, while the Playwright runner stages rendered HTML beside its JSON and PNG output. All three outputs publish under the runner's existing owned project lock and recovery transaction, preventing concurrent scans from mixing report generations. Existing HTML targets must be regular files, staged files use owner-only mode where supported, and a failed final HTML rename restores the previous screenshot, JSON, and HTML set.

`statecraft scan` returns both `htmlReportPath` and the machine-readable JSON `reportPath`, and its terminal summary points to the HTML document.
