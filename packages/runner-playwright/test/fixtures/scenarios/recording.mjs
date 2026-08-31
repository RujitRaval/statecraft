const eventKey = Symbol.for("uiwitness.test.scenario-events");

function record(hook, context) {
  if (!Object.isFrozen(context)) {
    throw new Error("Scenario context must be frozen.");
  }
  if (context.page.context() !== context.context) {
    throw new Error("Scenario page and browser context do not match.");
  }
  const events = globalThis[eventKey];
  if (!Array.isArray(events)) {
    throw new Error("Scenario event recorder is not initialized.");
  }
  events.push(
    `${hook}:${context.route.id}:${context.state.id}:${context.viewport.width}:${context.theme}`,
  );
}

export default {
  async beforeNavigate(context) {
    record("before", context);
    if (context.state.id === "before-failure") {
      throw new Error("before hook failed");
    }
  },
  async afterNavigate(context) {
    record("after", context);
    if (context.state.id === "after-failure") {
      throw new Error("after hook failed");
    }
  },
};
