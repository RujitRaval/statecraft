# uiwitness-report

Deterministic transformation and self-contained offline HTML generation for validated UIWitness schema-v1 reports.

```ts
import { renderReportHtml, transformReport } from "uiwitness-report";
```

The renderer accepts schema-v1 reports whose screenshots use either `.uiwitness/artifacts/**` or the legacy `.statecraft/artifacts/**` root. It preserves the accepted input root when deriving relative screenshot links, while new UIWitness reports are written to `.uiwitness/report/index.html`.

Most users should install [`uiwitness`](https://www.npmjs.com/package/uiwitness). Use this package directly when embedding UIWitness's report renderer in another local tool.

See the [report API documentation](https://github.com/RujitRaval/uiwitness/blob/main/docs/engineering/REPORT_API.md).
