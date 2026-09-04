# uiwitness-runner-playwright

The Playwright execution engine for UIWitness: isolated browser contexts, typed scenario hooks, deterministic navigation/readiness, screenshots, sanitized diagnostics, assertions, crash-recoverable local generation persistence, and bounded public-route discovery.

```ts
import { discoverPublicRoutes } from "uiwitness-runner-playwright";

const publicSurface = await discoverPublicRoutes("https://example.com");
```

```ts
import { runPublicSiteChecks } from "uiwitness-runner-playwright";

const evidence = await runPublicSiteChecks(publicSurface);
console.log(evidence.htmlReportPath);
```

```ts
import type { UIWitnessScenario } from "uiwitness-runner-playwright";
```

This fixed public-site check runs mobile/desktop by light/dark, fails only high-confidence navigation, HTTP, uncaught-page-error, and horizontal-overflow boundaries, and commits screenshots, schema-v1 JSON, offline HTML, and a digest-bound generation marker under the ignored local `.uiwitness/` directory. Check only sites you own or are authorized to test.

Persistence owns only the `.uiwitness/` transaction tree and does not open or modify legacy `.statecraft/` evidence. Private modes, control-path and link checks, shared generation locking, authenticated process-death recovery, and coherent rollback apply to every committed member.

Most users should install [`uiwitness`](https://www.npmjs.com/package/uiwitness). Use this package directly when composing the programmatic runner API.

See the [runner API documentation](https://github.com/RujitRaval/uiwitness/blob/main/docs/engineering/RUNNER_API.md).
