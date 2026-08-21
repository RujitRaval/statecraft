import { defineConfig } from "statecraft-ui";

const scenario = (route: "customers" | "dashboard" | "orders"): string =>
  `./statecraft/scenarios/${route}.mjs`;

export default defineConfig({
  baseURL:
    process.env["STATECRAFT_EXAMPLE_BASE_URL"] ?? "http://127.0.0.1:3000",
  routes: [
    {
      id: "dashboard",
      path: "/dashboard",
      states: ["success", "loading", "empty", "error"].map((id) => ({
        id,
        setup: scenario("dashboard"),
      })),
    },
    {
      id: "orders",
      path: "/orders",
      states: ["success", "loading", "empty", "error"].map((id) => ({
        id,
        setup: scenario("orders"),
      })),
    },
    {
      id: "customers",
      path: "/customers/cus-1048",
      states: [
        "success",
        "loading",
        "unauthorized",
        "forbidden",
        "not-found",
        "error",
        "long-content",
      ].map((id) => ({ id, setup: scenario("customers") })),
    },
  ],
  themes: ["light", "dark"],
  viewports: {
    mobile: { height: 844, width: 390 },
    desktop: { height: 1_000, width: 1_440 },
  },
});
