import { createHash } from "node:crypto";

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

function unique(values: readonly string[]): readonly string[] {
  return [...new Set(values)];
}

function selectOptions(
  allLabel: string,
  values: readonly string[],
): string {
  return `<option value="">${escapeHtml(allLabel)}</option>${values
    .map(
      (value) =>
        `<option value="${escapeHtml(value)}">${escapeHtml(words(value))}</option>`,
    )
    .join("")}`;
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
  return `<img class="${className}" src="${escapeHtml(cell.screenshotHref)}" alt="${escapeHtml(alt)}" width="${execution.viewport.width}" height="${execution.viewport.height}" loading="lazy">`;
}

function matrixCell(
  cell: ReportCellView | null,
  column: ReportColumnView,
  routeId: string,
  stateId: string,
): string {
  if (cell === null) {
    return `<div class="matrix-cell matrix-cell--missing" data-cell aria-label="${escapeHtml(`${routeId} ${stateId}, ${column.viewportId}, ${column.theme}: not captured`)}">Not captured</div>`;
  }
  const status = cell.execution.status;
  return `<a class="matrix-cell matrix-cell--${status}" data-cell data-detail-target="${escapeHtml(cell.detailId)}" href="#${escapeHtml(cell.detailId)}" aria-controls="${escapeHtml(cell.detailId)}" aria-label="${escapeHtml(`${routeId} ${stateId}, ${column.viewportId}, ${column.theme}: ${status}`)}">
    <span class="cell-status"><span class="status-dot" aria-hidden="true"></span>${escapeHtml(status)}</span>
    ${screenshot(cell, "thumbnail")}
  </a>`;
}

function filters(view: ReportViewModel): string {
  if (view.executions.length === 0) {
    return "";
  }
  const executions = view.executions.map((cell) => cell.execution);
  return `<section class="panel filters" aria-labelledby="filters-title">
    <div class="filters-heading">
      <div><p class="eyebrow">Focus the evidence</p><h2 id="filters-title">Filter executions</h2></div>
      <p id="filter-results" aria-live="polite">Showing ${executions.length} of ${executions.length} executions.</p>
    </div>
    <form id="report-filters">
      <label class="filter-control"><span>Route</span><select name="route">${selectOptions("All routes", unique(executions.map((execution) => execution.routeId)))}</select></label>
      <label class="filter-control"><span>State</span><select name="state">${selectOptions("All states", unique(executions.map((execution) => execution.stateId)))}</select></label>
      <label class="filter-control"><span>Viewport</span><select name="viewport">${selectOptions("All viewports", unique(executions.map((execution) => execution.viewportId)))}</select></label>
      <label class="filter-control"><span>Theme</span><select name="theme">${selectOptions("All themes", unique(executions.map((execution) => execution.theme)))}</select></label>
      <label class="filter-control"><span>Status</span><select name="status"><option value="">All statuses</option><option value="passed">Passed</option><option value="failed">Failed</option></select></label>
      <button class="reset-filters" type="reset" disabled>Reset filters</button>
    </form>
  </section>`;
}

function matrix(view: ReportViewModel): string {
  if (view.routes.length === 0) {
    return '<section class="panel empty-report" aria-labelledby="matrix-title"><h2 id="matrix-title">Coverage matrix</h2><p>No executions were selected for this report.</p></section>';
  }
  const heading = view.columns
    .map(
      (column) =>
        `<th scope="col" data-column data-viewport="${escapeHtml(column.viewportId)}" data-theme="${escapeHtml(column.theme)}"><span>${escapeHtml(columnLabel(column))}</span><small>${column.width} × ${column.height}</small></th>`,
    )
    .join("");
  const bodies = view.routes
    .map(
      (route) => `<tbody data-route-group="${escapeHtml(route.id)}">${route.rows
        .map(
        (row, rowIndex) => `<tr data-matrix-row data-route="${escapeHtml(row.routeId)}" data-state="${escapeHtml(row.stateId)}">
          <th class="route-heading" scope="rowgroup"${rowIndex === 0 ? ` rowspan="${route.rows.length}"` : " hidden"}><span>${escapeHtml(words(route.id))}</span><small>${escapeHtml(route.path)}</small></th>
          <th class="state-heading" scope="row" data-mobile-route="${escapeHtml(`${words(route.id)} · ${route.path}`)}"><span>${escapeHtml(words(row.stateId))}</span><small>${escapeHtml(row.scenarioSource)}</small></th>
          ${row.cells.map((cell, index) => {
            const column = view.columns[index]!;
            return `<td data-matrix-slot data-column-label="${escapeHtml(columnLabel(column))}" data-viewport="${escapeHtml(column.viewportId)}" data-theme="${escapeHtml(column.theme)}" data-status="${cell?.execution.status ?? "missing"}">${matrixCell(cell, column, row.routeId, row.stateId)}<span class="filtered-cell" hidden aria-hidden="true">—</span></td>`;
          }).join("")}
        </tr>`,
        )
        .join("")}</tbody>`,
    )
    .join("");
  return `<section class="panel matrix-panel" aria-labelledby="matrix-title">
    <div class="section-heading"><div><p class="eyebrow">Configured product states</p><h2 id="matrix-title">Coverage matrix</h2></div><p>Open a cell to inspect its evidence and diagnostics.</p></div>
    <div class="matrix-scroll" tabindex="0" aria-label="Scrollable coverage matrix">
      <table><caption class="sr-only">Execution status and screenshot evidence by route, state, viewport, and theme.</caption><thead><tr><th scope="col">Route</th><th scope="col">State</th>${heading}</tr></thead>${bodies}</table>
    </div>
    <div class="no-results" id="no-results" hidden><strong>No executions match these filters.</strong><span>Reset one or more filters to restore the matrix.</span></div>
  </section>`;
}

function detail(cell: ReportCellView): string {
  const execution = cell.execution;
  const navigationStatus = execution.diagnostics.navigationStatus;
  const detailTitleId = `${cell.detailId}-title`;
  return `<article class="panel detail" id="${escapeHtml(cell.detailId)}" data-detail data-route="${escapeHtml(execution.routeId)}" data-state="${escapeHtml(execution.stateId)}" data-viewport="${escapeHtml(execution.viewportId)}" data-theme="${escapeHtml(execution.theme)}" data-status="${execution.status}" tabindex="-1" aria-labelledby="${escapeHtml(detailTitleId)}">
    <div class="detail-heading">
      <div><p class="eyebrow">${escapeHtml(words(execution.routeId))} / ${escapeHtml(words(execution.stateId))}</p><h2 id="${escapeHtml(detailTitleId)}">${escapeHtml(words(execution.viewportId))} · ${escapeHtml(words(execution.theme))}</h2></div>
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
      <details${execution.failures.length > 0 ? " open" : ""}><summary><span>Failures</span><strong>${execution.failures.length}</strong></summary><div class="diagnostic-body">${failures(execution)}</div></details>
      <details><summary><span>Console errors</span><strong>${execution.diagnostics.consoleErrors.length}</strong></summary><div class="diagnostic-body">${diagnosticList(execution.diagnostics.consoleErrors, "No console errors captured.")}</div></details>
      <details><summary><span>Page errors</span><strong>${execution.diagnostics.pageErrors.length}</strong></summary><div class="diagnostic-body">${diagnosticList(execution.diagnostics.pageErrors, "No page errors captured.")}</div></details>
      <details><summary><span>Failed requests</span><strong>${execution.diagnostics.failedRequests.length}</strong></summary><div class="diagnostic-body">${requestList(execution)}</div></details>
    </div>
    <a class="back-link" data-close-detail href="#matrix-title">Close details and return to matrix</a>
  </article>`;
}

const interactions = `
(() => {
  const form = document.querySelector("#report-filters");
  if (!(form instanceof HTMLFormElement)) return;
  document.documentElement.classList.add("js");

  const selects = Array.from(form.querySelectorAll("select"));
  const rows = Array.from(document.querySelectorAll("[data-matrix-row]"));
  const columns = Array.from(document.querySelectorAll("[data-column]"));
  const details = Array.from(document.querySelectorAll("[data-detail]"));
  const triggers = Array.from(document.querySelectorAll("[data-detail-target]"));
  const triggerById = new Map(triggers.map((trigger) => [trigger.dataset.detailTarget, trigger]));
  const result = document.querySelector("#filter-results");
  const noResults = document.querySelector("#no-results");
  const reset = form.querySelector("[type=reset]");
  let activeDetail = null;
  let activeTrigger = null;
  let lastTrigger = null;

  const values = () => Object.fromEntries(selects.map((select) => [select.name, select.value]));
  const matches = (actual, selected) => selected === "" || actual === selected;
  const detailMatches = (detail, filters) =>
    matches(detail.dataset.route, filters.route) &&
    matches(detail.dataset.state, filters.state) &&
    matches(detail.dataset.viewport, filters.viewport) &&
    matches(detail.dataset.theme, filters.theme) &&
    matches(detail.dataset.status, filters.status);

  function updateRouteHeading(group) {
    const visibleRows = Array.from(group.querySelectorAll("[data-matrix-row]")).filter((row) => !row.hidden);
    const headings = Array.from(group.querySelectorAll(".route-heading"));
    headings.forEach((heading) => {
      heading.hidden = true;
      heading.removeAttribute("rowspan");
    });
    if (visibleRows.length > 0) {
      const heading = visibleRows[0].querySelector(".route-heading");
      heading.hidden = false;
      heading.rowSpan = visibleRows.length;
    }
    group.hidden = visibleRows.length === 0;
  }

  function writeFilterUrl(filters) {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== "") params.set(key, value);
    });
    const query = params.size > 0 ? "?" + params.toString() : "";
    history.replaceState(null, "", query + window.location.hash);
  }

  function closeDetail(returnFocus = false, updateHash = false) {
    if (activeDetail instanceof HTMLElement) {
      activeDetail.hidden = true;
      activeDetail.classList.remove("is-active");
    }
    if (activeTrigger instanceof HTMLElement) activeTrigger.removeAttribute("aria-current");
    activeDetail = null;
    activeTrigger = null;
    if (updateHash) history.pushState(null, "", window.location.search + "#matrix-title");
    if (returnFocus && lastTrigger instanceof HTMLElement) lastTrigger.focus();
  }

  function openDetail(id, trigger = null, updateHash = true) {
    const detail = document.getElementById(id);
    if (!(detail instanceof HTMLElement) || detail.dataset.filterMatch !== "true") return;
    closeDetail(false, false);
    detail.hidden = false;
    detail.classList.add("is-active");
    activeDetail = detail;
    const currentTrigger = triggerById.get(id);
    if (currentTrigger instanceof HTMLElement) {
      currentTrigger.setAttribute("aria-current", "true");
      activeTrigger = currentTrigger;
      lastTrigger = currentTrigger;
    } else if (trigger instanceof HTMLElement) {
      lastTrigger = trigger;
    }
    if (updateHash) history.pushState(null, "", window.location.search + "#" + id);
    detail.focus({ preventScroll: true });
    detail.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  }

  function applyFilters(updateUrl = true, updateDetailHistory = true) {
    const filters = values();
    columns.forEach((column) => {
      column.hidden = !matches(column.dataset.viewport, filters.viewport) || !matches(column.dataset.theme, filters.theme);
    });

    let visibleRowCount = 0;
    rows.forEach((row) => {
      const rowMatches = matches(row.dataset.route, filters.route) && matches(row.dataset.state, filters.state);
      let visibleSlots = 0;
      let matchingExecutions = 0;
      row.querySelectorAll("[data-matrix-slot]").forEach((slot) => {
        const coordinateMatches = matches(slot.dataset.viewport, filters.viewport) && matches(slot.dataset.theme, filters.theme);
        slot.hidden = !coordinateMatches;
        if (!coordinateMatches) return;
        visibleSlots += 1;
        const statusMatches = matches(slot.dataset.status, filters.status);
        const cell = slot.querySelector("[data-cell]");
        const placeholder = slot.querySelector(".filtered-cell");
        if (cell instanceof HTMLElement) cell.hidden = !statusMatches;
        if (placeholder instanceof HTMLElement) placeholder.hidden = statusMatches;
        if (statusMatches && slot.dataset.status !== "missing") matchingExecutions += 1;
      });
      row.hidden = !rowMatches || (filters.status === "" ? visibleSlots === 0 : matchingExecutions === 0);
      if (!row.hidden) visibleRowCount += 1;
    });
    document.querySelectorAll("[data-route-group]").forEach(updateRouteHeading);

    let executionCount = 0;
    details.forEach((detail) => {
      const isMatch = detailMatches(detail, filters);
      detail.dataset.filterMatch = String(isMatch);
      if (isMatch) executionCount += 1;
    });
    if (activeDetail instanceof HTMLElement && activeDetail.dataset.filterMatch !== "true") closeDetail(false, updateDetailHistory);
    if (result) result.textContent = "Showing " + executionCount + " of " + details.length + " executions across " + visibleRowCount + " matrix " + (visibleRowCount === 1 ? "row." : "rows.");
    if (noResults instanceof HTMLElement) noResults.hidden = executionCount !== 0;
    if (reset instanceof HTMLButtonElement) reset.disabled = selects.every((select) => select.value === "");
    if (updateUrl) writeFilterUrl(filters);
  }

  function restoreFiltersFromUrl() {
    const params = new URLSearchParams(window.location.search);
    selects.forEach((select) => {
      const value = params.get(select.name);
      select.value = value !== null && Array.from(select.options).some((option) => option.value === value) ? value : "";
    });
  }

  function syncDetailFromHash() {
    const id = window.location.hash.slice(1);
    if (id.startsWith("execution-")) {
      if (!(activeDetail instanceof HTMLElement) || activeDetail.id !== id) openDetail(id, null, false);
    } else if (activeDetail !== null) closeDetail(true, false);
  }

  function syncStateFromUrl() {
    restoreFiltersFromUrl();
    applyFilters(false, false);
    syncDetailFromHash();
  }

  form.addEventListener("change", () => applyFilters());
  form.addEventListener("reset", () => requestAnimationFrame(() => applyFilters()));
  document.addEventListener("click", (event) => {
    const trigger = event.target instanceof Element ? event.target.closest("[data-detail-target]") : null;
    if (trigger instanceof HTMLAnchorElement) {
      event.preventDefault();
      openDetail(trigger.dataset.detailTarget, trigger);
      return;
    }
    const close = event.target instanceof Element ? event.target.closest("[data-close-detail]") : null;
    if (close instanceof HTMLAnchorElement) {
      event.preventDefault();
      closeDetail(true, true);
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && activeDetail !== null) {
      event.preventDefault();
      closeDetail(true, true);
    }
  });
  window.addEventListener("hashchange", syncDetailFromHash);
  window.addEventListener("popstate", syncStateFromUrl);

  restoreFiltersFromUrl();
  details.forEach((detail) => { detail.hidden = true; });
  applyFilters(false);
  syncDetailFromHash();
})();`;

const interactionHash = createHash("sha256")
  .update(interactions)
  .digest("base64");

const styles = `
:root{color-scheme:dark;--bg:#090b10;--panel:#11151d;--panel-2:#171c26;--line:#293140;--text:#f4f7fb;--muted:#9aa6b8;--accent:#5ee0b1;--pass:#4ade80;--fail:#fb7185;font-family:"Avenir Next","Segoe UI Variable",Ubuntu,sans-serif}
*{box-sizing:border-box}[hidden]{display:none!important}.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}html{background:var(--bg);scroll-behavior:smooth}body{margin:0;background:radial-gradient(circle at 15% -10%,#123c38 0,transparent 34rem),var(--bg);color:var(--text);font-size:16px;line-height:1.5}a{color:inherit}.skip-link{position:fixed;top:10px;left:10px;z-index:20;padding:12px 16px;border-radius:10px;background:var(--accent);color:#071510;font-weight:800;transform:translateY(-160%)}.skip-link:focus{transform:translateY(0)}code{font-family:"SFMono-Regular",Consolas,monospace;font-size:.88em;overflow-wrap:anywhere}.shell{width:min(1600px,calc(100% - 32px));margin:0 auto;padding:48px 0 96px}.hero{display:grid;grid-template-columns:minmax(0,1.6fr) minmax(260px,.7fr);gap:24px;align-items:end;margin-bottom:28px}.brand{display:inline-flex;align-items:center;gap:10px;color:#b9f8e3;font-weight:750;letter-spacing:.02em}.brand-mark{display:grid;place-items:center;width:30px;height:30px;border:1px solid #38c99c;border-radius:9px;background:linear-gradient(145deg,#249c78,#155e4a);box-shadow:0 10px 30px #2dc79a44}.eyebrow{margin:0 0 8px;color:#7ee7c4;font-size:.75rem;font-weight:800;letter-spacing:.14em;text-transform:uppercase}.hero h1{max-width:780px;margin:18px 0 10px;font-size:clamp(2.5rem,6vw,5.8rem);line-height:.94;letter-spacing:-.065em;text-wrap:balance}.lede{max-width:720px;margin:0;color:var(--muted);font-size:clamp(1rem,2vw,1.2rem)}.score{padding:26px;border:1px solid #285248;border-radius:20px;background:linear-gradient(145deg,#102420,#11151d);box-shadow:0 24px 80px #0008}.score strong{display:block;font-size:clamp(2.5rem,7vw,5rem);line-height:1;letter-spacing:-.06em;font-variant-numeric:tabular-nums}.score span{color:var(--muted)}.run-meta{display:flex;flex-wrap:wrap;gap:10px 24px;margin:0 0 24px;color:var(--muted);font-size:.82rem}.run-meta code{color:#d7ddea}.summary{display:grid;grid-template-columns:repeat(6,minmax(120px,1fr));gap:12px;margin-bottom:28px}.metric{padding:18px;border:1px solid var(--line);border-radius:16px;background:#10141bd9}.metric span{display:block;color:var(--muted);font-size:.75rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase}.metric strong{display:block;margin-top:5px;font-size:1.65rem;letter-spacing:-.04em;font-variant-numeric:tabular-nums}.metric--failed strong{color:var(--fail)}.panel{border:1px solid var(--line);border-radius:20px;background:var(--panel);box-shadow:0 24px 80px #0005}.filters{padding:22px;margin-bottom:18px}.filters-heading{display:flex;align-items:end;justify-content:space-between;gap:24px;margin-bottom:16px}.filters-heading h2{margin:0;font-size:1.35rem;letter-spacing:-.025em}.filters-heading>p{margin:0;color:var(--muted)}#report-filters{display:grid;grid-template-columns:repeat(5,minmax(130px,1fr)) auto;gap:10px;align-items:end}.filter-control span{display:block;margin:0 0 5px;color:var(--muted);font-size:.75rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase}.filter-control select,.reset-filters{width:100%;min-height:44px;border:1px solid #3a4558;border-radius:10px;background:#0d1117;color:var(--text);font:inherit}.filter-control select{padding:8px 34px 8px 11px}.filter-control select:hover,.reset-filters:hover:not(:disabled){border-color:#4dbb99}.filter-control select:focus-visible,.reset-filters:focus-visible,.back-link:focus-visible,summary:focus-visible{outline:3px solid var(--accent);outline-offset:2px}.reset-filters{padding:8px 14px;color:#b9f8e3;font-weight:750;cursor:pointer}.reset-filters:disabled{color:#657184;cursor:not-allowed;opacity:.7}.matrix-panel{padding:22px;margin-bottom:28px}.section-heading{display:flex;justify-content:space-between;gap:24px;align-items:end;margin-bottom:18px}.section-heading h2,.detail h2,.empty-report h2{margin:0;font-size:1.6rem;letter-spacing:-.035em}.section-heading>p{max-width:420px;margin:0;color:var(--muted);text-align:right}.matrix-scroll{overflow:auto;border:1px solid var(--line);border-radius:14px}.matrix-scroll:focus-visible{outline:3px solid var(--accent);outline-offset:3px}table{width:100%;min-width:max-content;border-collapse:separate;border-spacing:0;background:#0d1117}th,td{border-right:1px solid var(--line);border-bottom:1px solid var(--line);padding:10px;text-align:left;vertical-align:top}thead th{position:sticky;top:0;z-index:2;background:#171c26;color:#e7eaf0}th:last-child,td:last-child{border-right:0}tbody tr:last-child th,tbody tr:last-child td{border-bottom:0}th span{display:block}th small{display:block;max-width:220px;margin-top:3px;color:var(--muted);font-weight:500}.route-heading{min-width:145px;background:#141924}.state-heading{min-width:170px;background:#10151e}.matrix-cell{display:block;width:224px;min-height:154px;overflow:hidden;border:1px solid var(--line);border-radius:11px;background:var(--panel-2);text-decoration:none;transition:border-color .15s ease,transform .15s ease}.matrix-cell:hover{border-color:#3cae8a;transform:translateY(-1px)}.matrix-cell:focus-visible{outline:3px solid var(--accent);outline-offset:2px}.matrix-cell[aria-current=true]{border-color:var(--accent);box-shadow:0 0 0 1px var(--accent)}.matrix-cell--failed{border-color:#6f3342}.matrix-cell--missing{display:grid;place-items:center;color:#8793a5;border-style:dashed}.filtered-cell{display:grid;width:224px;min-height:154px;place-items:center;color:#657184;font-size:1.5rem}.cell-status{display:flex;align-items:center;gap:7px;padding:7px 10px;color:#cad1dc;font-size:.75rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase}.status-dot{width:7px;height:7px;border-radius:99px;background:var(--pass);box-shadow:0 0 0 3px #4ade8020}.matrix-cell--failed .status-dot{background:var(--fail);box-shadow:0 0 0 3px #fb718520}.thumbnail{display:block;width:100%;height:120px;object-fit:cover;object-position:top;background:#080a0d}.no-results{padding:32px 16px 12px;text-align:center}.no-results strong,.no-results span{display:block}.no-results span{margin-top:4px;color:var(--muted)}.detail{padding:24px;margin-top:22px;scroll-margin-top:18px}.detail:focus-visible,.detail.is-active{outline:2px solid var(--accent);outline-offset:4px}.detail-heading{display:flex;justify-content:space-between;gap:20px;align-items:start;margin-bottom:20px}.status-badge{padding:7px 11px;border-radius:999px;font-size:.75rem;font-weight:850;letter-spacing:.08em;text-transform:uppercase}.status-badge--passed{color:#b7f7cb;background:#173823}.status-badge--failed{color:#ffc1cc;background:#4a1f2b}.detail-layout{display:grid;grid-template-columns:minmax(0,2fr) minmax(260px,.72fr);gap:20px}.evidence{overflow:hidden;border:1px solid var(--line);border-radius:14px;background:#080a0d}.full-screenshot{display:block;width:100%;height:auto}.screenshot-missing{display:grid;min-height:240px;place-items:center;color:var(--muted)}.metadata{padding:8px 18px;border:1px solid var(--line);border-radius:14px;background:var(--panel-2)}dl{margin:0}dl div{padding:11px 0;border-bottom:1px solid var(--line)}dl div:last-child{border-bottom:0}dt{color:var(--muted);font-size:.75rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase}dd{margin:3px 0 0;overflow-wrap:anywhere}.diagnostics{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:20px}.diagnostics details{min-width:0;border:1px solid var(--line);border-radius:14px;background:#0d1117}.diagnostics summary{display:flex;min-height:44px;align-items:center;justify-content:space-between;gap:12px;padding:10px 16px;font-weight:750;cursor:pointer}.diagnostics summary strong{display:grid;min-width:25px;height:25px;place-items:center;border-radius:99px;background:#202735;color:#dce2eb;font-size:.75rem;font-variant-numeric:tabular-nums}.diagnostic-body{padding:0 16px 16px;border-top:1px solid var(--line)}.diagnostic-body ul{margin:14px 0 0;padding-left:18px;color:#cbd2dd}.diagnostic-body li+li{margin-top:9px}.diagnostic-body span,.empty-detail{color:var(--muted)}.diagnostic-body .empty-detail{margin:14px 0 0}.back-link{display:inline-flex;align-items:center;min-height:44px;margin-top:12px;padding:8px 2px;color:#7ee7c4;font-weight:700}.back-link:visited{color:#62cbaa}.empty-report{padding:32px}.footer{margin-top:36px;color:var(--muted);text-align:center;font-size:.8125rem}
@media(max-width:1180px){#report-filters{grid-template-columns:repeat(3,1fr)}.reset-filters{width:auto}}
@media(max-width:1000px){.hero,.detail-layout{grid-template-columns:1fr}.summary{grid-template-columns:repeat(3,1fr)}.score{max-width:420px}.section-heading{align-items:start;flex-direction:column}.section-heading>p{text-align:left}.diagnostics{grid-template-columns:1fr}}
@media(max-width:700px){.shell{width:min(100% - 20px,1600px);padding-top:28px}.hero h1{font-size:3rem}.summary{grid-template-columns:repeat(2,1fr)}.filters,.matrix-panel,.detail{padding:14px}.filters-heading,.detail-heading{align-items:start;flex-direction:column}.filters-heading{gap:8px}#report-filters{grid-template-columns:1fr}.reset-filters{width:100%}.run-meta{display:grid;gap:6px}.metric{padding:14px}.matrix-scroll{overflow:visible;border:0}.matrix-scroll>table{display:block;width:100%;max-width:100%;min-width:0;table-layout:fixed;background:transparent}.matrix-scroll thead,.matrix-scroll .route-heading{display:none!important}.matrix-scroll tbody{display:block;width:100%}.matrix-scroll tbody+tbody{margin-top:12px}.matrix-scroll tr{display:grid;width:100%;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;padding:10px;border:1px solid var(--line);border-radius:12px;background:#0d1117}.matrix-scroll tr+tr{margin-top:8px}.matrix-scroll .state-heading{display:block;grid-column:1/-1;min-width:0;padding:2px 2px 9px;border:0;background:transparent}.state-heading:before{content:attr(data-mobile-route);display:block;margin-bottom:3px;color:#7ee7c4;font-size:.72rem;font-weight:800;letter-spacing:.06em;text-transform:uppercase}.matrix-scroll td{display:block;min-width:0;padding:0;border:0}.matrix-scroll td:before{content:attr(data-column-label);display:block;margin:0 0 5px;color:var(--muted);font-size:.72rem;font-weight:800}.matrix-cell,.filtered-cell{width:100%;min-height:128px}.thumbnail{height:96px}}
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
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; script-src 'sha256-${interactionHash}'; base-uri 'none'; form-action 'none'">
  <meta name="color-scheme" content="dark">
  <title>Statecraft · UI State Coverage Report</title>
  <style>${styles}</style>
</head>
<body>
  <a class="skip-link" href="#matrix-title">Skip to coverage matrix</a>
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
    ${filters(view)}
    <div id="matrix">${matrix(view)}</div>
    <section aria-label="Execution details">${view.executions.map(detail).join("")}</section>
    <footer class="footer">Generated locally by Statecraft · No network or server required</footer>
  </main>
  <script>${interactions}</script>
</body>
</html>
`;
}
