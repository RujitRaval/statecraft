# statecraft-ui-runner-playwright

The Playwright execution engine for Statecraft: isolated browser contexts, typed scenario hooks, deterministic navigation/readiness, screenshots, sanitized diagnostics, assertions, coordinated local report persistence, and bounded public-route discovery.

```ts
import { discoverPublicRoutes } from "statecraft-ui-runner-playwright";

const publicSurface = await discoverPublicRoutes("https://example.com");
```

```ts
import { runPublicSiteChecks } from "statecraft-ui-runner-playwright";

const evidence = await runPublicSiteChecks(publicSurface);
console.log(evidence.htmlReportPath);
```

```ts
import type { StatecraftScenario } from "statecraft-ui-runner-playwright";
```

This fixed public-site check runs mobile/desktop by light/dark, fails only high-confidence navigation, HTTP, uncaught-page-error, and horizontal-overflow boundaries, and writes screenshots plus schema-v1 JSON and offline HTML under the ignored local `.statecraft/` directory. Check only sites you own or are authorized to test.

Most users should install [`statecraft-ui`](https://www.npmjs.com/package/statecraft-ui). Use this package directly when composing the programmatic runner API.

See the [runner API documentation](https://github.com/RujitRaval/statecraft/blob/main/docs/engineering/RUNNER_API.md).
