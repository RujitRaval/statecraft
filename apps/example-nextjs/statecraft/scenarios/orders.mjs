import {
  assertForegroundContrast,
  assertVisibleProductState,
  fulfillJson,
  holdRequest,
  waitForProductState,
} from "./shared.mjs";

const attribute = "data-orders-state";

export default {
  async beforeNavigate({ page, state }) {
    if (state.id === "success") return;
    if (state.id === "loading") {
      await page.route("**/api/orders", holdRequest);
      return;
    }
    if (state.id === "empty") {
      await page.route("**/api/orders", (route) =>
        fulfillJson(route, 200, {
          orders: [],
          updatedAt: "20 Aug 2026 · 14:32 EDT",
        }),
      );
      return;
    }
    await page.route("**/api/orders", (route) =>
      fulfillJson(route, 503, { message: "Unavailable" }),
    );
  },
  async afterNavigate({ page, state }) {
    await waitForProductState(page, attribute, state.id);
  },
  async assert({ page, state }) {
    await assertVisibleProductState(page, attribute, state.id);
    if (state.id === "error") {
      await assertForegroundContrast(page, ".orders-error__signal");
    }
  },
};
