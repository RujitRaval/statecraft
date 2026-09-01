const eventKey = Symbol.for("uiwitness.test.navigation-events");
const redirectOriginKey = Symbol.for(
  "uiwitness.test.navigation-redirect-origin",
);
const transparentPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZKMcAAAAASUVORK5CYII=",
  "base64",
);

function record(event) {
  const events = globalThis[eventKey];
  if (!Array.isArray(events)) {
    throw new Error("Navigation event recorder is not initialized.");
  }
  events.push(event);
}

function crossOriginUrl(pathname) {
  const origin = globalThis[redirectOriginKey];
  if (typeof origin !== "string") {
    throw new Error("Navigation redirect origin is not initialized.");
  }
  return new URL(pathname, origin).href;
}

function pageMarkup(stateId) {
  const readyScript =
    stateId === "ready"
      ? `setTimeout(() => {
          const ready = document.createElement("div");
          ready.id = "ready";
          ready.textContent = "ready";
          document.body.append(ready);
        }, 10);`
      : "";

  return `<!doctype html>
    <html>
      <head>
        <style>
          @keyframes pulse { from { opacity: 0.25; } to { opacity: 1; } }
          #animated { animation: pulse 2s infinite; transition: opacity 3s; }
        </style>
        <script>
          globalThis.uiwitnessBoot = {
            dark: matchMedia("(prefers-color-scheme: dark)").matches,
            reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
            theme: document.documentElement.dataset.theme,
          };
        </script>
      </head>
      <body>
        <main id="content">${stateId}</main>
        <div id="animated">animated</div>
        <input id="caret" value="stable" />
        <img id="slow-image" src="/slow.png" alt="fixture" />
        <script>${readyScript}</script>
      </body>
    </html>`;
}

export default {
  async beforeNavigate({ context, state, theme }) {
    record(`before:${state.id}:${theme}`);
    if (state.id === "before-failure") {
      throw new Error("before navigation hook failed");
    }
    await context.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (state.id === "navigation-failure" && url.pathname === "/fixture") {
        await route.abort("failed");
        return;
      }
      if (url.pathname === "/slow.png") {
        await new Promise((resolve) => setTimeout(resolve, 40));
        await route.fulfill({
          body: transparentPng,
          contentType: "image/png",
          status: 200,
        });
        return;
      }
      if (url.pathname === "/slow-font.woff2") {
        await new Promise((resolve) => setTimeout(resolve, 80));
        record(`font-response:${state.id}:${theme}`);
        await route.fulfill({
          body: Buffer.from("uiwitness delayed font fixture"),
          contentType: "font/woff2",
          status: 200,
        });
        return;
      }
      if (url.pathname === "/fixture") {
        if (state.id === "redirect-cross-origin") {
          await route.fulfill({
            headers: { location: crossOriginUrl("/redirected") },
            status: 302,
          });
          return;
        }
        await route.fulfill({
          body: pageMarkup(state.id),
          contentType: "text/html",
          status: 207,
        });
        return;
      }
      if (url.pathname === "/same-origin") {
        await route.fulfill({
          body: pageMarkup(state.id),
          contentType: "text/html",
          status: 208,
        });
        return;
      }
      if (url.pathname === "/during-readiness") {
        await route.fulfill({
          body: pageMarkup(state.id),
          contentType: "text/html",
          status: 209,
        });
        return;
      }
      await route.fallback();
    });
  },

  async afterNavigate({ page, state, theme }) {
    if (state.id === "after-cross-origin") {
      await page.goto(crossOriginUrl("/after-hook"));
    }
    if (state.id === "after-same-origin") {
      await page.goto(new URL("/same-origin", page.url()).href);
    }
    if (state.id === "after-ready") {
      await page.evaluate(() => {
        setTimeout(() => {
          const ready = globalThis.document.createElement("div");
          ready.id = "ready";
          ready.textContent = "ready after hook";
          globalThis.document.body.append(ready);
        }, 10);
      });
    }
    if (state.id === "font-ready") {
      await page.waitForLoadState("load");
      await page.evaluate(() => {
        const font = new globalThis.FontFace(
          "UIWitnessDelayed",
          "url('/slow-font.woff2')",
        );
        globalThis.document.fonts.add(font);
        void font.load().catch(() => undefined);
      });
    }
    if (state.id === "readiness-cross-origin") {
      await page.waitForLoadState("load");
      await page.evaluate(
        ({ redirectUrl }) => {
          const font = new globalThis.FontFace(
            "UIWitnessDelayed",
            "url('/slow-font.woff2')",
          );
          globalThis.document.fonts.add(font);
          void font.load().catch(() => undefined);
          setTimeout(() => {
            globalThis.location.href = redirectUrl;
          }, 10);
        },
        { redirectUrl: crossOriginUrl("/during-readiness") },
      );
    }
    if (state.id === "readiness-same-origin") {
      await page.waitForLoadState("load");
      await page.evaluate(() => {
        const font = new globalThis.FontFace(
          "UIWitnessDelayed",
          "url('/slow-font.woff2')",
        );
        globalThis.document.fonts.add(font);
        void font.load().catch(() => undefined);
        setTimeout(() => {
          globalThis.location.href = "/during-readiness";
        }, 10);
      });
    }
    record(`after:${state.id}:${theme}`);
    if (state.id === "after-failure") {
      throw new Error("after navigation hook failed");
    }
  },
};
