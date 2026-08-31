import { publicSiteScenario } from "uiwitness/public-site-scenario";

const assertion: unknown = publicSiteScenario.assert;

// @ts-expect-error The runner-owned assertion is intentionally opaque.
publicSiteScenario.assert({});

void assertion;
