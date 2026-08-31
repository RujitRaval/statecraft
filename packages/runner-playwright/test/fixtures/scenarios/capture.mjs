const eventKey = Symbol.for("statecraft.test.capture-events");
const redirectOriginKey = Symbol.for("statecraft.test.capture-redirect-origin");

function record(event) {
  const events = globalThis[eventKey];
  if (!Array.isArray(events)) {
    throw new Error("Capture event recorder is not initialized.");
  }
  events.push(event);
}

function crossOriginUrl(pathname) {
  const origin = globalThis[redirectOriginKey];
  if (typeof origin !== "string") {
    throw new Error("Capture redirect origin is not initialized.");
  }
  return new URL(pathname, origin).href;
}

function pageMarkup(stateId) {
  return `<!doctype html>
    <html>
      <body style="margin: 0; min-height: 1200px">
        <main data-state="${stateId}">${stateId}</main>
      </body>
    </html>`;
}

async function emitDiagnostics(page, stateId) {
  if (stateId === "nonfatal" || stateId === "all-diagnostics") {
    await page.evaluate(() => {
      console.error(
        "request https://uiwitness.invalid/private?token=visible#fragment " +
          "Bearer bearer-value api_key=plain-value",
      );
      return fetch("/failed-resource?token=visible&mode=test#fragment").catch(
        () => undefined,
      );
    });
  }
  if (stateId === "page-error" || stateId === "all-diagnostics") {
    await page.evaluate(() => {
      setTimeout(() => {
        throw new Error(
          "page failed at https://uiwitness.invalid/private?secret=visible#fragment token=plain-value",
        );
      }, 0);
    });
    await page.waitForTimeout(20);
  }
  if (stateId === "diagnostic-burst") {
    await page.evaluate(() => {
      for (let index = 0; index < 105; index += 1) {
        console.error(`diagnostic ${index}`);
      }
    });
  }
  if (stateId === "failed-request-burst") {
    await page.evaluate(() =>
      Promise.all(
        Array.from({ length: 105 }, (_, index) =>
          fetch(`/failed-resource?index=${index}&token=visible`).catch(
            () => undefined,
          ),
        ),
      ),
    );
  }
}

export default {
  async beforeNavigate({ context, state }) {
    await context.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (state.id === "redirect-cross-origin" && url.pathname === "/capture") {
        await route.fulfill({
          headers: {
            location: crossOriginUrl(
              "/private?token=visible&return=private#fragment",
            ),
          },
          status: 302,
        });
        return;
      }
      if (state.id === "navigation-fail" && url.pathname === "/capture") {
        await route.abort("failed");
        return;
      }
      if (url.pathname === "/failed-resource") {
        await route.abort("failed");
        return;
      }
      if (url.pathname === "/capture") {
        await route.fulfill({
          body: pageMarkup(state.id),
          contentType: "text/html",
          status: 206,
        });
        return;
      }
      await route.fallback();
    });
  },

  async afterNavigate({ page, state }) {
    await emitDiagnostics(page, state.id);
    if (state.id === "post-response-fail") {
      throw new Error("after navigation failed token=visible");
    }
    if (state.id === "screenshot-fail") {
      page.screenshot = async () => {
        throw new Error("screenshot failed token=visible");
      };
    }
    if (state.id === "ordered") {
      const screenshot = page.screenshot.bind(page);
      page.screenshot = async (options) => {
        record("screenshot");
        return screenshot(options);
      };
    }
  },

  async assert({ state }) {
    record(`assert:${state.id}`);
    if (state.id === "assertion-fail") {
      throw new Error("assertion failed password=visible");
    }
    if (state.id === "assertion-unprintable") {
      throw Object.create(null);
    }
  },
};
