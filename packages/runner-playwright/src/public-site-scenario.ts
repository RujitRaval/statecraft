import type {
  AssertionScenarioContext,
  StatecraftScenario,
} from "./scenario.js";

/** Horizontal overflow at or below this CSS-pixel delta is ignored. */
export const PUBLIC_SITE_OVERFLOW_TOLERANCE_PX = 1;

/** @internal Stable source recorded for Quick Check's trusted in-memory scenario. */
export const publicSiteScenarioSource = "statecraft:public-site";

/**
 * High-confidence assertions for a public page that Statecraft cannot otherwise
 * control. Console errors and subordinate request failures remain diagnostics;
 * the caller-owned failure policy decides whether they fail an execution.
 */
export const publicSiteScenario: StatecraftScenario = Object.freeze({
  assert: async ({
    navigation,
    page,
  }: AssertionScenarioContext) => {
    if (navigation.status === null) {
      throw new Error("The main document did not return an HTTP response.");
    }
    if (navigation.status >= 400) {
      throw new Error(
        `The main document returned HTTP status ${navigation.status}.`,
      );
    }

    const overflow = await page.evaluate(() => {
      const root = document.documentElement;
      const body = document.body;
      const contentWidth = Math.max(
        root?.scrollWidth ?? 0,
        body?.scrollWidth ?? 0,
      );
      const viewportWidth = root?.clientWidth ?? window.innerWidth;
      return Math.max(0, contentWidth - viewportWidth);
    });
    if (overflow > PUBLIC_SITE_OVERFLOW_TOLERANCE_PX) {
      throw new Error(
        `The document overflows horizontally by ${overflow} CSS pixels (allowed tolerance: ${PUBLIC_SITE_OVERFLOW_TOLERANCE_PX}).`,
      );
    }
  },
});
