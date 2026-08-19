import {
  ConfigValidationError,
  StatecraftError,
  defineConfig,
  expandMatrix,
  parseConfig,
  type ConfigValidationIssue,
  type ConfigValidationIssueCode,
  type FailurePolicy,
  type MatrixCell,
  type MatrixFilter,
  type RouteDefinition,
  type StateDefinition,
  type StatecraftConfig,
  type StatecraftErrorCode,
  type ViewportDefinition,
} from "@statecraft/core";

const config = defineConfig({
  baseURL: "http://localhost:3000",
  failOn: { pageError: true },
  routes: [
    {
      id: "dashboard",
      path: "/dashboard",
      states: [{ id: "success", setup: "./scenarios/dashboard/success.ts" }],
    },
  ],
  themes: ["light"],
  viewports: { desktop: { height: 900, width: 1440 } },
});

const parsed: StatecraftConfig = parseConfig(config);
const filter: MatrixFilter = { routeIds: ["dashboard"] };
const matrix: readonly MatrixCell[] = expandMatrix(parsed, filter);
const validationError: StatecraftError = new ConfigValidationError([]);
void parsed;
void matrix;
void validationError;

export type PublicTypeContract = {
  config: StatecraftConfig;
  errorCode: StatecraftErrorCode;
  failurePolicy: FailurePolicy;
  issue: ConfigValidationIssue;
  issueCode: ConfigValidationIssueCode;
  route: RouteDefinition;
  state: StateDefinition;
  viewport: ViewportDefinition;
};

defineConfig({
  baseURL: "http://localhost:3000",
  routes: [{ id: "dashboard", path: "/dashboard", states: [{ id: "success", setup: "./scenario.ts" }] }],
  themes: ["light"],
  viewports: { desktop: { height: 900, width: 1440 } },
  // @ts-expect-error Unknown configuration properties must be rejected.
  telemetry: true,
});

defineConfig({
  baseURL: "http://localhost:3000",
  failOn: {
    // @ts-expect-error Failure policy values must remain boolean.
    pageError: "yes",
  },
  routes: [{ id: "dashboard", path: "/dashboard", states: [{ id: "success", setup: "./scenario.ts" }] }],
  themes: ["light"],
  viewports: { desktop: { height: 900, width: 1440 } },
});
