# uiwitness-report

Deterministic transformation and self-contained offline HTML generation for validated UIWitness schema-v1 reports and optional State Contract Guard verdicts.

```ts
import {
  renderReportHtml,
  transformReport,
  type ContractVerdictReportInput,
} from "uiwitness-report";

const html = renderReportHtml(report, {
  contractVerdict: verdict satisfies ContractVerdictReportInput,
});
```

The renderer accepts schema-v1 reports whose screenshots use either `.uiwitness/artifacts/**` or the legacy `.statecraft/artifacts/**` root. It preserves the accepted input root when deriving relative screenshot links, while new UIWitness reports are written to `.uiwitness/report/index.html`.

When `contractVerdict` is provided, the report validates and leads with the contract promise, canonical findings, exact commands, and contract/config/run digests before retaining the existing evidence matrix and inspector. Omitting it preserves the execution-only report.

Most users should install [`uiwitness`](https://www.npmjs.com/package/uiwitness). Use this package directly when embedding UIWitness's report renderer in another local tool.

See the [report API documentation](https://github.com/RujitRaval/uiwitness/blob/main/docs/engineering/REPORT_API.md).
