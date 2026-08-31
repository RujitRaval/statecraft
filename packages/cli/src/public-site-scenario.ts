import { publicSiteScenario as runnerPublicSiteScenario } from "uiwitness-runner-playwright";

/** Narrow helper shape used by generated Quick Check scenario modules. */
export interface PublicSiteScenarioHelper {
  /** Opaque runtime assertion consumed by UIWitness's scenario loader. */
  readonly assert: unknown;
}

/**
 * Runner-owned high-confidence public-page assertions, re-exported from the
 * installed CLI package so generated projects need only `uiwitness`.
 */
export const publicSiteScenario =
  runnerPublicSiteScenario as unknown as PublicSiteScenarioHelper;
