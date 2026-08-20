import type { ExecutionResult } from "@statecraft/core";

import {
  transformReport,
  type ReportCellView,
  type ReportColumnView,
  type ReportViewModel,
} from "./transform.js";

function escapeHtml(value: string | number): string {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function words(value: string): string {
  return value
    .split("-")
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function duration(value: number): string {
  if (value < 1_000) {
    return `${value} ms`;
  }
  return `${(value / 1_000).toFixed(value < 10_000 ? 1 : 0)} s`;
}

function columnLabel(column: ReportColumnView): string {
  return `${words(column.viewportId)} · ${words(column.theme)}`;
}

function diagnosticList(values: readonly string[], empty: string): string {
  if (values.length === 0) {
    return `<p class="empty-detail">${escapeHtml(empty)}</p>`;
  }
  return `<ul>${values.map((value) => `<li>${escapeHtml(value)}</li>`).join("")}</ul>`;
}

function requestList(execution: ExecutionResult): string {
  if (execution.diagnostics.failedRequests.length === 0) {
    return '<p class="empty-detail">No failed requests captured.</p>';
  }
  return `<ul>${execution.diagnostics.failedRequests
    .map(
      (request) =>
        `<li><strong>${escapeHtml(request.method)}</strong> ${escapeHtml(request.url)}<br><span>${escapeHtml(request.errorText)}</span></li>`,
    )
    .join("")}</ul>`;
}

function failures(execution: ExecutionResult): string {
  if (execution.failures.length === 0) {
    return '<p class="empty-detail">No execution failures.</p>';
  }
  return `<ul>${execution.failures
    .map(
      (failure) =>
        `<li><strong>${escapeHtml(failure.code)}</strong><br>${escapeHtml(failure.message)}</li>`,
    )
    .join("")}</ul>`;
}

function screenshot(cell: ReportCellView, className: string): string {
  if (cell.screenshotHref === null) {
    return '<div class="screenshot-missing">Screenshot unavailable</div>';
  }
  const execution = cell.execution;
  const alt = `${words(execution.routeId)} ${words(execution.stateId)}, ${words(execution.viewportId)}, ${words(execution.theme)} theme`;
  return `<img class="${className}" src="${escapeHtml(cell.screenshotHref)}" alt="${escapeHtml(alt)}" loading="lazy">`;
}

function matrixCell(
  cell: ReportCellView | null,
  column: ReportColumnView,
  routeId: string,
  stateId: string,
): string {
  if (cell === null) {
    return `<div class="matrix-cell matrix-cell--missing" aria-label="${escapeHtml(`${routeId} ${stateId}, ${column.viewportId}, ${column.theme}: not captured`)}">Not captured</div>`;
  }
  const status = cell.execution.status;
  return `<a class="matrix-cell matrix-cell--${status}" href="#${escapeHtml(cell.detailId)}" aria-label="${escapeHtml(`${routeId} ${stateId}, ${column.viewportId}, ${column.theme}: ${status}`)}">
    <span class="cell-status"><span class="status-dot" aria-hidden="true"></span>${escapeHtml(status)}</span>
    ${screenshot(cell, "thumbnail")}
  </a>`;
}

function matrix(view: ReportViewModel): string {
  if (view.routes.length === 0) {
    return '<section class="panel empty-report" aria-labelledby="matrix-title"><h2 id="matrix-title">Coverage matrix</h2><p>No executions were selected for this report.</p></section>';
  }
  const heading = view.columns
    .map(
      (column) =>
        `<th scope="col"><span>${escapeHtml(columnLabel(column))}</span><small>${column.width} × ${column.height}</small></th>`,
    )
    .join("");
  const rows = view.routes
    .flatMap((route) =>
      route.rows.map(
        (row, rowIndex) => `<tr>
          ${rowIndex === 0 ? `<th class="route-heading" scope="rowgroup" rowspan="${route.rows.length}"><span>${escapeHtml(words(route.id))}</span><small>${escapeHtml(route.path)}</small></th>` : ""}
          <th class="state-heading" scope="row"><span>${escapeHtml(words(row.stateId))}</span><small>${escapeHtml(row.scenarioSource)}</small></th>
          ${row.cells.map((cell, index) => `<td>${matrixCell(cell, view.columns[index]!, row.routeId, row.stateId)}</td>`).join("")}
        </tr>`,
      ),
    )
    .join("");
  return `<section class="panel matrix-panel" aria-labelledby="matrix-title">
    <div class="section-heading"><div><p class="eyebrow">Configured product states</p><h2 id="matrix-title">Coverage matrix</h2></div><p>Open a cell to inspect its evidence and diagnostics.</p></div>
    <div class="matrix-scroll" tabindex="0" aria-label="Scrollable coverage matrix">
      <table><thead><tr><th scope="col">Route</th><th scope="col">State</th>${heading}</tr></thead><tbody>${rows}</tbody></table>
    </div>
  </section>`;
}

function detail(cell: ReportCellView): string {
  const execution = cell.execution;
  const navigationStatus = execution.diagnostics.navigationStatus;
  return `<article class="panel detail" id="${escapeHtml(cell.detailId)}" tabindex="-1">
    <div class="detail-heading">
      <div><p class="eyebrow">${escapeHtml(words(execution.routeId))} / ${escapeHtml(words(execution.stateId))}</p><h2>${escapeHtml(words(execution.viewportId))} · ${escapeHtml(words(execution.theme))}</h2></div>
      <span class="status-badge status-badge--${execution.status}">${escapeHtml(execution.status)}</span>
    </div>
    <div class="detail-layout">
      <div class="evidence">${screenshot(cell, "full-screenshot")}</div>
      <div class="metadata">
        <dl>
          <div><dt>Route</dt><dd><code>${escapeHtml(execution.routePath)}</code></dd></div>
          <div><dt>URL</dt><dd><code>${escapeHtml(execution.url)}</code></dd></div>
          <div><dt>Viewport</dt><dd>${escapeHtml(execution.viewportId)} · ${execution.viewport.width} × ${execution.viewport.height}</dd></div>
          <div><dt>Theme</dt><dd>${escapeHtml(execution.theme)}</dd></div>
          <div><dt>Duration</dt><dd>${escapeHtml(duration(execution.durationMs))}</dd></div>
          <div><dt>Navigation</dt><dd>${navigationStatus === null ? "Not available" : navigationStatus}</dd></div>
          <div><dt>Scenario</dt><dd><code>${escapeHtml(execution.scenarioSource)}</code></dd></div>
        </dl>
      </div>
    </div>
    <div class="diagnostics">
      <section><h3>Failures</h3>${failures(execution)}</section>
      <section><h3>Console errors</h3>${diagnosticList(execution.diagnostics.consoleErrors, "No console errors captured.")}</section>
      <section><h3>Page errors</h3>${diagnosticList(execution.diagnostics.pageErrors, "No page errors captured.")}</section>
      <section><h3>Failed requests</h3>${requestList(execution)}</section>
    </div>
    <a class="back-link" href="#matrix-title">Back to matrix</a>
  </article>`;
}

const styles = `
:root{color-scheme:dark;--bg:#090b10;--panel:#11151d;--panel-2:#171c26;--line:#293140;--text:#f4f7fb;--muted:#9aa6b8;--accent:#8a7dff;--accent-2:#39d6b4;--pass:#4ade80;--fail:#fb7185;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
*{box-sizing:border-box}html{background:var(--bg);scroll-behavior:smooth}body{margin:0;background:radial-gradient(circle at 15% -10%,#2c2362 0,transparent 34rem),var(--bg);color:var(--text);font-size:15px;line-height:1.5}a{color:inherit}code{font-family:"SFMono-Regular",Consolas,monospace;font-size:.88em;overflow-wrap:anywhere}.shell{width:min(1600px,calc(100% - 32px));margin:0 auto;padding:48px 0 96px}.hero{display:grid;grid-template-columns:minmax(0,1.6fr) minmax(260px,.7fr);gap:24px;align-items:end;margin-bottom:28px}.brand{display:inline-flex;align-items:center;gap:10px;color:#d8d4ff;font-weight:750;letter-spacing:.02em}.brand-mark{display:grid;place-items:center;width:30px;height:30px;border:1px solid #7567ed;border-radius:9px;background:linear-gradient(145deg,#7567ed,#473b9d);box-shadow:0 10px 30px #6c5ce755}.eyebrow{margin:0 0 8px;color:#aaa2ff;font-size:.72rem;font-weight:800;letter-spacing:.14em;text-transform:uppercase}.hero h1{max-width:780px;margin:18px 0 10px;font-size:clamp(2.5rem,6vw,5.8rem);line-height:.94;letter-spacing:-.065em}.lede{max-width:720px;margin:0;color:var(--muted);font-size:clamp(1rem,2vw,1.2rem)}.score{padding:26px;border:1px solid #3b3764;border-radius:20px;background:linear-gradient(145deg,#1b1830,#11151d);box-shadow:0 24px 80px #0008}.score strong{display:block;font-size:clamp(2.5rem,7vw,5rem);line-height:1;letter-spacing:-.06em}.score span{color:var(--muted)}.run-meta{display:flex;flex-wrap:wrap;gap:10px 24px;margin:0 0 24px;color:var(--muted);font-size:.82rem}.run-meta code{color:#d7ddea}.summary{display:grid;grid-template-columns:repeat(6,minmax(120px,1fr));gap:12px;margin-bottom:28px}.metric{padding:18px;border:1px solid var(--line);border-radius:16px;background:#10141bd9}.metric span{display:block;color:var(--muted);font-size:.75rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase}.metric strong{display:block;margin-top:5px;font-size:1.65rem;letter-spacing:-.04em}.metric--failed strong{color:var(--fail)}.panel{border:1px solid var(--line);border-radius:20px;background:var(--panel);box-shadow:0 24px 80px #0005}.matrix-panel{padding:22px;margin-bottom:28px}.section-heading{display:flex;justify-content:space-between;gap:24px;align-items:end;margin-bottom:18px}.section-heading h2,.detail h2,.empty-report h2{margin:0;font-size:1.6rem;letter-spacing:-.035em}.section-heading>p{max-width:420px;margin:0;color:var(--muted);text-align:right}.matrix-scroll{overflow:auto;border:1px solid var(--line);border-radius:14px}.matrix-scroll:focus-visible{outline:3px solid var(--accent);outline-offset:3px}table{width:100%;min-width:max-content;border-collapse:separate;border-spacing:0;background:#0d1117}th,td{border-right:1px solid var(--line);border-bottom:1px solid var(--line);padding:10px;text-align:left;vertical-align:top}thead th{position:sticky;top:0;z-index:2;background:#171c26;color:#e7eaf0}th:last-child,td:last-child{border-right:0}tbody tr:last-child th,tbody tr:last-child td{border-bottom:0}th span{display:block}th small{display:block;max-width:220px;margin-top:3px;color:var(--muted);font-weight:500}.route-heading{min-width:145px;background:#141924}.state-heading{min-width:170px;background:#10151e}.matrix-cell{display:block;width:224px;min-height:154px;overflow:hidden;border:1px solid var(--line);border-radius:11px;background:var(--panel-2);text-decoration:none;transition:border-color .15s ease,transform .15s ease}.matrix-cell:hover{border-color:#6f63d4;transform:translateY(-1px)}.matrix-cell:focus-visible{outline:3px solid var(--accent);outline-offset:2px}.matrix-cell--failed{border-color:#6f3342}.matrix-cell--missing{display:grid;place-items:center;color:#6f7a8b;border-style:dashed}.cell-status{display:flex;align-items:center;gap:7px;padding:7px 10px;color:#cad1dc;font-size:.7rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase}.status-dot{width:7px;height:7px;border-radius:99px;background:var(--pass);box-shadow:0 0 0 3px #4ade8020}.matrix-cell--failed .status-dot{background:var(--fail);box-shadow:0 0 0 3px #fb718520}.thumbnail{display:block;width:100%;height:120px;object-fit:cover;object-position:top;background:#080a0d}.detail{padding:24px;margin-top:22px;scroll-margin-top:18px}.detail:focus{outline:none}.detail:target{border-color:#6458c7;box-shadow:0 0 0 1px #6458c7,0 24px 80px #0007}.detail-heading{display:flex;justify-content:space-between;gap:20px;align-items:start;margin-bottom:20px}.status-badge{padding:7px 11px;border-radius:999px;font-size:.72rem;font-weight:850;letter-spacing:.08em;text-transform:uppercase}.status-badge--passed{color:#b7f7cb;background:#173823}.status-badge--failed{color:#ffc1cc;background:#4a1f2b}.detail-layout{display:grid;grid-template-columns:minmax(0,2fr) minmax(260px,.72fr);gap:20px}.evidence{overflow:hidden;border:1px solid var(--line);border-radius:14px;background:#080a0d}.full-screenshot{display:block;width:100%;height:auto}.screenshot-missing{display:grid;min-height:240px;place-items:center;color:var(--muted)}.metadata{padding:8px 18px;border:1px solid var(--line);border-radius:14px;background:var(--panel-2)}dl{margin:0}dl div{padding:11px 0;border-bottom:1px solid var(--line)}dl div:last-child{border-bottom:0}dt{color:var(--muted);font-size:.7rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase}dd{margin:3px 0 0;overflow-wrap:anywhere}.diagnostics{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:20px}.diagnostics section{min-width:0;padding:16px;border:1px solid var(--line);border-radius:14px;background:#0d1117}.diagnostics h3{margin:0 0 10px;font-size:.9rem}.diagnostics ul{margin:0;padding-left:18px;color:#cbd2dd}.diagnostics li+li{margin-top:9px}.diagnostics span,.empty-detail{color:var(--muted)}.empty-detail{margin:0}.back-link{display:inline-flex;align-items:center;min-height:44px;margin-top:12px;padding:8px 2px;color:#c1baff;font-weight:700}.empty-report{padding:32px}.footer{margin-top:36px;color:var(--muted);text-align:center;font-size:.8rem}
@media(max-width:1000px){.hero,.detail-layout{grid-template-columns:1fr}.summary{grid-template-columns:repeat(3,1fr)}.score{max-width:420px}.section-heading{align-items:start;flex-direction:column}.section-heading>p{text-align:left}.diagnostics{grid-template-columns:1fr}}
@media(max-width:620px){.shell{width:min(100% - 20px,1600px);padding-top:28px}.hero h1{font-size:3rem}.summary{grid-template-columns:repeat(2,1fr)}.matrix-panel,.detail{padding:14px}.detail-heading{align-items:start;flex-direction:column}.run-meta{display:grid;gap:6px}.metric{padding:14px}}
@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}.matrix-cell{transition:none}}
`;

/** Renders one validated report as a network-independent HTML document. */
export function renderReportHtml(input: unknown): string {
  const view = transformReport(input);
  const summary = view.summary;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
  <meta name="color-scheme" content="dark">
  <title>Statecraft · UI State Coverage Report</title>
  <style>${styles}</style>
</head>
<body>
  <main class="shell">
    <header class="hero">
      <div>
        <div class="brand"><span class="brand-mark" aria-hidden="true">S</span>Statecraft</div>
        <h1>UI State Coverage Report</h1>
        <p class="lede">A visual inventory of every configured route, state, viewport, and theme.</p>
      </div>
      <div class="score" aria-label="${summary.passed} of ${summary.executions} executions passed">
        <p class="eyebrow">Execution coverage</p>
        <strong>${escapeHtml(summary.coverage.execution.percentage)}%</strong>
        <span>${summary.passed} passed / ${summary.executions} expected</span>
      </div>
    </header>
    <p class="run-meta"><span>Generated <code>${escapeHtml(view.generatedAt)}</code></span><span>Base URL <code>${escapeHtml(view.baseURL)}</code></span><span>Schema v${view.schemaVersion}</span></p>
    <section class="summary" aria-label="Report summary">
      <div class="metric"><span>Routes</span><strong>${summary.routes}</strong></div>
      <div class="metric"><span>States</span><strong>${summary.states}</strong></div>
      <div class="metric"><span>Executions</span><strong>${summary.executions}</strong></div>
      <div class="metric"><span>Passed</span><strong>${summary.passed}</strong></div>
      <div class="metric metric--failed"><span>Failed</span><strong>${summary.failed}</strong></div>
      <div class="metric"><span>Duration</span><strong>${escapeHtml(duration(summary.durationMs))}</strong></div>
    </section>
    <div id="matrix">${matrix(view)}</div>
    <section aria-label="Execution details">${view.executions.map(detail).join("")}</section>
    <footer class="footer">Generated locally by Statecraft · No network or server required</footer>
  </main>
</body>
</html>
`;
}
