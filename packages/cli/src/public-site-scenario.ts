import { publicSiteScenario as runnerPublicSiteScenario } from "statecraft-ui-runner-playwright";

/** Narrow helper shape used by generated Quick Check scenario modules. */
export interface PublicSiteScenarioHelper {
  /** Opaque runtime assertion consumed by Statecraft's scenario loader. */
  readonly assert: unknown;
}

/**
 * Runner-owned high-confidence public-page assertions, re-exported from the
 * installed CLI package so generated projects need only `statecraft-ui`.
 */
export const publicSiteScenario =
  runnerPublicSiteScenario as unknown as PublicSiteScenarioHelper;
