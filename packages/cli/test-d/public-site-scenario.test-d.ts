import { publicSiteScenario } from "statecraft-ui/public-site-scenario";

const assertion: unknown = publicSiteScenario.assert;

// @ts-expect-error The runner-owned assertion is intentionally opaque.
publicSiteScenario.assert({});

void assertion;
