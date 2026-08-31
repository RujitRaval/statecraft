import {
  assertVisibleProductState,
  fulfillJson,
  holdRequest,
  waitForProductState,
} from "./shared.mjs";

const attribute = "data-dashboard-state";

export default {
  async beforeNavigate({ page, state }) {
    if (state.id === "success") return;
    if (state.id === "loading") {
      await page.route("**/api/dashboard", holdRequest);
      return;
    }
    if (state.id === "empty") {
      await page.route("**/api/dashboard", (route) =>
        fulfillJson(route, 200, {
          metrics: [],
          orders: [],
          pulse: [],
          summary: {
            atRisk: 0,
            fulfilledToday: 0,
            nextDispatch: "Not scheduled",
          },
        }),
      );
      return;
    }
    await page.route("**/api/dashboard", (route) =>
      fulfillJson(route, 503, { message: "Unavailable" }),
    );
  },
  async afterNavigate({ page, state }) {
    await waitForProductState(page, attribute, state.id);
  },
  async assert({ page, state }) {
    await assertVisibleProductState(page, attribute, state.id);
  },
};
