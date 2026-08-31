# uiwitness-runner-playwright

The Playwright execution engine for UIWitness: isolated browser contexts, typed scenario hooks, deterministic navigation/readiness, screenshots, sanitized diagnostics, assertions, coordinated local report persistence, and bounded public-route discovery.

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

This fixed public-site check runs mobile/desktop by light/dark, fails only high-confidence navigation, HTTP, uncaught-page-error, and horizontal-overflow boundaries, and writes screenshots plus schema-v1 JSON and offline HTML under the ignored local `.uiwitness/` directory. Check only sites you own or are authorized to test.

Persistence owns only the `.uiwitness/` transaction tree and does not open or modify legacy `.statecraft/` evidence. Existing private file modes, symbolic-link checks, locking, recovery, and coherent rollback apply to the new root.

Most users should install [`uiwitness`](https://www.npmjs.com/package/uiwitness). Use this package directly when composing the programmatic runner API.

See the [runner API documentation](https://github.com/RujitRaval/uiwitness/blob/main/docs/engineering/RUNNER_API.md).
