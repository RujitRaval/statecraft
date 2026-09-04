export { renderReportHtml } from "./render.js";
export type {
  ContractVerdictReportInput,
  RenderReportOptions,
} from "./contract-verdict.js";
/** Stable project-relative location of the generated offline report. */
export const REPORT_HTML_PATH = ".uiwitness/report/index.html" as const;
export { transformReport } from "./transform.js";
export type {
  ReportCellView,
  ReportColumnView,
  ReportRouteView,
  ReportRowView,
  ReportViewModel,
} from "./transform.js";
