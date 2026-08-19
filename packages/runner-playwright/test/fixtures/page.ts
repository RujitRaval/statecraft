import type { Page } from "playwright";

/** Renders the smallest real Chromium page needed to prove runner isolation. */
export async function renderFixturePage(page: Page): Promise<void> {
  await page.setContent(`<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"><title>Statecraft runner fixture</title></head>
  <body><main id="fixture">ready</main></body>
</html>`);
}
