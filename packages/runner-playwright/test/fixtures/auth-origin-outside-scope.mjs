export default async function setupAuthentication({ page }) {
  await page.route("https://other.example/**", (route) =>
    route.fulfill({ body: "<main>outside</main>", contentType: "text/html" })
  );
  await page.goto("https://other.example/login");
  await page.evaluate(() => localStorage.setItem("token", "SECRET_OUTSIDE_SCOPE"));
}
