import {
  assertNoHorizontalOverflow,
  assertVisibleProductState,
  fulfillJson,
  holdRequest,
  longCustomerFixture,
  waitForProductState,
} from "./shared.mjs";

const attribute = "data-customer-state";

function renderedState(stateId) {
  if (stateId === "forbidden") return "unauthorized";
  if (stateId === "long-content") return "success";
  return stateId;
}

export default {
  async beforeNavigate({ page, state }) {
    if (state.id === "success") return;
    if (state.id === "loading") {
      await page.route("**/api/customers/**", holdRequest);
      return;
    }
    if (state.id === "long-content") {
      await page.route("**/api/customers/**", (route) =>
        fulfillJson(route, 200, longCustomerFixture),
      );
      return;
    }
    const status = {
      unauthorized: 401,
      forbidden: 403,
      "not-found": 404,
      error: 503,
    }[state.id];
    await page.route("**/api/customers/**", (route) =>
      fulfillJson(route, status, { message: "Scenario response" }),
    );
  },
  async afterNavigate({ page, state }) {
    await waitForProductState(page, attribute, renderedState(state.id));
  },
  async assert({ page, state }) {
    await assertVisibleProductState(page, attribute, renderedState(state.id));
    if (state.id === "unauthorized" || state.id === "forbidden") {
      const expectedStatus = state.id === "unauthorized" ? "401" : "403";
      const status = await page
        .locator(".customer-access-state__visual span")
        .textContent();
      if (status?.trim() !== expectedStatus) {
        throw new Error(
          `Expected ${state.id} scenario to render HTTP ${expectedStatus}.`,
        );
      }
    }
    if (state.id === "long-content") {
      await assertNoHorizontalOverflow(page);
    }
  },
};
