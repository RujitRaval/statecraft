import { join } from "node:path";

import type { UIWitnessReport } from "uiwitness-core";
import { PUBLIC_SITE_CHECK_CONTRACT } from "uiwitness-runner-playwright/public-site-contract";

import type { CheckDiscovery } from "./check.js";
import {
  planConfigPublication,
  publishConfigLast,
  type ConfigPublicationPlan,
} from "./project-files.js";

const SCENARIO_RELATIVE_PATH = join(
  "uiwitness",
  "scenarios",
  "public",
  "default.mts",
);
const SCENARIO_CONFIG_PATH = "./uiwitness/scenarios/public/default.mts";

const SCENARIO_TEMPLATE = `import { publicSiteScenario } from "uiwitness/public-site-scenario";

export default publicSiteScenario;
`;

export interface PublicSiteSetupResult {
  readonly configPath: string;
  readonly files: readonly string[];
  readonly projectRoot: string;
  readonly scenarioPath: string;
}

function routeIdForPath(report: UIWitnessReport, path: string): string {
  const routeIds = new Set(
    report.executions
      .filter(
        (execution) =>
          execution.routePath === path && execution.stateId === "public",
      )
      .map((execution) => execution.routeId),
  );
  if (routeIds.size !== 1) {
    throw new TypeError(
      `The completed public-site report does not contain one route identity for ${path}.`,
    );
  }
  return [...routeIds][0]!;
}

function configTemplate(
  discovery: CheckDiscovery,
  report: UIWitnessReport,
): string {
  const configValue = (value: unknown): string =>
    JSON.stringify(value, null, 2).replaceAll("\n", "\n  ");
  const routes = discovery.routes
    .map((route) => {
      const id = routeIdForPath(report, route.path);
      return `    {
      id: ${JSON.stringify(id)},
      path: ${JSON.stringify(route.path)},
      states: [
        {
          id: "public",
          setup: "${SCENARIO_CONFIG_PATH}",
        },
      ],
    }`;
    })
    .join(",\n");

  return `import { defineConfig } from "uiwitness";

export default defineConfig({
  baseURL: ${JSON.stringify(discovery.baseURL)},
  failOn: ${configValue(PUBLIC_SITE_CHECK_CONTRACT.failOn)},
  viewports: ${configValue(PUBLIC_SITE_CHECK_CONTRACT.viewports)},
  themes: ${configValue(PUBLIC_SITE_CHECK_CONTRACT.themes)},
  routes: [
${routes}
  ],
});
`;
}

/** @internal Preflights every generated path before Quick Check starts a browser. */
export function planPublicSiteSetup(
  cwd: string,
): Promise<ConfigPublicationPlan> {
  return planConfigPublication(cwd, SCENARIO_RELATIVE_PATH);
}

/** @internal Publishes the discovered surface after evidence persistence completes. */
export async function publishPublicSiteSetup(
  plan: ConfigPublicationPlan,
  discovery: CheckDiscovery,
  report: UIWitnessReport,
): Promise<PublicSiteSetupResult> {
  await publishConfigLast(plan, {
    config: configTemplate(discovery, report),
    scenario: SCENARIO_TEMPLATE,
  });
  return Object.freeze({
    configPath: plan.configPath,
    files: Object.freeze([plan.configPath, plan.scenarioPath]),
    projectRoot: plan.projectRoot,
    scenarioPath: plan.scenarioPath,
  });
}
