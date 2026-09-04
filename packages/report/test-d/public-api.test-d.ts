import type { UIWitnessReport } from "uiwitness-core";
import {
  REPORT_HTML_PATH,
  renderReportHtml,
  transformReport,
  type ContractVerdictReportInput,
  type RenderReportOptions,
  type ReportCellView,
  type ReportColumnView,
  type ReportRouteView,
  type ReportRowView,
  type ReportViewModel,
} from "uiwitness-report";

declare const report: UIWitnessReport;

const reportPath: ".uiwitness/report/index.html" = REPORT_HTML_PATH;
const html: string = renderReportHtml(report);
declare const contractVerdict: ContractVerdictReportInput;
const reportOptions: RenderReportOptions = { contractVerdict };
const contractHtml: string = renderReportHtml(report, reportOptions);
const view: ReportViewModel = transformReport(report);
const columns: readonly ReportColumnView[] = view.columns;
const routes: readonly ReportRouteView[] = view.routes;
const rows: readonly ReportRowView[] = routes[0]?.rows ?? [];
const cells: readonly (ReportCellView | null)[] = rows[0]?.cells ?? [];

// @ts-expect-error Report projections are immutable.
view.columns.push(columns[0]!);
// @ts-expect-error Execution details are immutable.
view.executions[0]!.execution.failures.push({
  code: "INTERNAL_ERROR",
  message: "mutated",
});

void reportPath;
void html;
void contractHtml;
void cells;
