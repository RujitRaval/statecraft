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

## Persistence

```ts
import { writeReportHtml } from "@statecraft/report";

const output = await writeReportHtml(schemaV1Report, {
  projectDirectory: process.cwd(),
});
// .statecraft/report/index.html
```

`writeReportHtml` validates the report before filesystem mutation, canonicalizes an existing project root, requires real `.statecraft/` and `report/` directory boundaries, and refuses an existing symbolic-link or non-file HTML target. It writes a uniquely named owner-private temporary file, flushes it, atomically renames it to `.statecraft/report/index.html`, and normalizes owner-only mode where supported. A failed temporary publication is cleaned up without deleting the previous HTML report.

Expected publication failures use `ReportWriteError` and stable `REPORT_ROOT_INVALID`, `REPORT_OUTPUT_INVALID`, or `REPORT_WRITE_FAILED` codes. `REPORT_HTML_PATH` is the stable project-relative output contract.

`statecraft scan` invokes this writer only after the runner has safely published screenshots and schema-v1 JSON. The terminal summary points to the HTML document, while `ScanResult` retains both `htmlReportPath` and the machine-readable JSON `reportPath`.
