const counterKey = Symbol.for("uiwitness.test.authSetupCount");

export default async function setupAuthentication({ context, page }) {
  globalThis[counterKey] = (globalThis[counterKey] ?? 0) + 1;
  const secret = process.env.UIWITNESS_AUTH_SECRET_CANARY ?? "missing";
  await page.route("https://uiwitness.invalid/**", (route) =>
    route.fulfill({ body: "<main>authenticated</main>", contentType: "text/html" })
  );
  await page.goto("https://uiwitness.invalid/login");
  await page.evaluate((value) => localStorage.setItem("uiwitness-auth", value), secret);
  await context.addCookies([{
    name: "uiwitness-auth",
    url: "https://uiwitness.invalid",
    value: secret,
  }]);
}
