import { describe, expect, it } from "vitest";

import {
  ConfigValidationError,
  defineConfig,
  parseConfig,
  type UIWitnessConfig,
} from "../src/index.js";

function validConfig(): UIWitnessConfig {
  return {
    baseURL: "http://localhost:3000",
    failOn: {
      consoleError: false,
      failedRequest: false,
      pageError: true,
    },
    routes: [
      {
        id: "dashboard",
        path: "/dashboard",
        states: [
          {
            id: "success",
            setup: "./statecraft/scenarios/dashboard/success.ts",
          },
          {
            id: "payment-declined",
            setup: "./statecraft/scenarios/dashboard/payment-declined.ts",
          },
        ],
      },
    ],
    themes: ["light", "high-contrast"],
    viewports: {
      desktop: { height: 1000, width: 1440 },
      mobile: { height: 844, width: 390 },
    },
  };
}

function captureValidationError(input: unknown): ConfigValidationError {
  try {
    parseConfig(input);
  } catch (error: unknown) {
    expect(error).toBeInstanceOf(ConfigValidationError);
    return error as ConfigValidationError;
  }
  throw new Error("Expected config validation to fail.");
}

describe("defineConfig", () => {
  it("provides typing without cloning or changing the config", () => {
    const config = validConfig();

    expect(defineConfig(config)).toBe(config);
  });
});

describe("parseConfig", () => {
  it("parses the documented configuration shape", () => {
    const config = validConfig();

    expect(parseConfig(config)).toEqual(config);
  });

  it.each([
    {
      label: "non-object input",
      mutate: (): unknown => null,
      expected: { code: "invalid_type", path: "$" },
    },
    {
      label: "non-HTTP base URL",
      mutate: (): unknown => ({ ...validConfig(), baseURL: "file:///tmp/app" }),
      expected: { code: "invalid_value", path: "$.baseURL" },
    },
    {
      label: "malformed base URL",
      mutate: (): unknown => ({ ...validConfig(), baseURL: "not a URL" }),
      expected: { code: "invalid_value", path: "$.baseURL" },
    },
    {
      label: "invalid route ID",
      mutate: (): unknown => ({
        ...validConfig(),
        routes: [{ ...validConfig().routes[0], id: "Dashboard Route" }],
      }),
      expected: { code: "invalid_value", path: "$.routes[0].id" },
    },
    {
      label: "route path without a leading slash",
      mutate: (): unknown => ({
        ...validConfig(),
        routes: [{ ...validConfig().routes[0], path: "dashboard" }],
      }),
      expected: { code: "invalid_value", path: "$.routes[0].path" },
    },
    {
      label: "protocol-relative route path",
      mutate: (): unknown => ({
        ...validConfig(),
        routes: [{ ...validConfig().routes[0], path: "//other.example/dashboard" }],
      }),
      expected: { code: "invalid_value", path: "$.routes[0].path" },
    },
    {
      label: "backslash authority route path",
      mutate: (): unknown => ({
        ...validConfig(),
        routes: [{ ...validConfig().routes[0], path: "/\\evil.example/dashboard" }],
      }),
      expected: { code: "invalid_value", path: "$.routes[0].path" },
    },
    {
      label: "empty scenario setup path",
      mutate: (): unknown => ({
        ...validConfig(),
        routes: [
          {
            ...validConfig().routes[0],
            states: [{ id: "success", setup: "  " }],
          },
        ],
      }),
      expected: { code: "invalid_value", path: "$.routes[0].states[0].setup" },
    },
    {
      label: "fractional viewport dimension",
      mutate: (): unknown => ({
        ...validConfig(),
        viewports: { mobile: { height: 844, width: 390.5 } },
      }),
      expected: { code: "invalid_type", path: "$.viewports.mobile.width" },
    },
    {
      label: "unknown root property",
      mutate: (): unknown => ({ ...validConfig(), telemetry: true }),
      expected: { code: "unrecognized_key", path: "$" },
    },
  ])("rejects $label with a stable issue", ({ mutate, expected }) => {
    const error = captureValidationError(mutate());

    expect(error.code).toBe("CONFIG_INVALID");
    expect(error.message).toBe("Invalid UIWitness configuration.");
    expect(error.issues).toEqual(expect.arrayContaining([expect.objectContaining(expected)]));
  });

  it.each([
    ["routes", { routes: [] }, "$.routes"],
    ["themes", { themes: [] }, "$.themes"],
    ["viewports", { viewports: {} }, "$.viewports"],
    [
      "route states",
      { routes: [{ id: "dashboard", path: "/dashboard", states: [] }] },
      "$.routes[0].states",
    ],
  ])("requires non-empty %s", (_label, replacement, expectedPath) => {
    const error = captureValidationError({ ...validConfig(), ...replacement });

    expect(error.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "invalid_value", path: expectedPath }),
      ]),
    );
  });

  it("reports duplicate route, state, and theme IDs at deterministic paths", () => {
    const firstRoute = validConfig().routes[0];
    if (firstRoute === undefined) {
      throw new Error("Fixture route is missing.");
    }
    const duplicatedRoute = {
      ...firstRoute,
      states: [firstRoute.states[0], firstRoute.states[0]],
    };
    const error = captureValidationError({
      ...validConfig(),
      routes: [duplicatedRoute, duplicatedRoute],
      themes: ["light", "light"],
    });

    expect(error.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "duplicate", path: "$.routes[0].states[1].id" }),
        expect.objectContaining({ code: "duplicate", path: "$.routes[1].id" }),
        expect.objectContaining({ code: "duplicate", path: "$.themes[1]" }),
      ]),
    );
  });

  it("keeps every accepted route on the configured origin", () => {
    const config = parseConfig(validConfig());

    for (const route of config.routes) {
      expect(new URL(route.path, config.baseURL).origin).toBe(
        new URL(config.baseURL).origin,
      );
    }
  });

  it("freezes its public issue collection", () => {
    const error = captureValidationError(null);

    expect(Object.isFrozen(error.issues)).toBe(true);
    expect(Object.isFrozen(error.issues[0])).toBe(true);
  });
});
