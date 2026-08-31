import { z, type ZodIssue } from "zod";

import {
  ConfigValidationError,
  type ConfigValidationIssue,
  type ConfigValidationIssueCode,
} from "./errors.js";

/** Pixel dimensions for a named browser viewport. */
export interface ViewportDefinition {
  readonly height: number;
  readonly width: number;
}

/** A named product state and the trusted local scenario module that sets it up. */
export interface StateDefinition {
  readonly id: string;
  readonly setup: string;
}

/** A configured application route and its explicitly declared product states. */
export interface RouteDefinition {
  readonly id: string;
  readonly path: string;
  readonly states: readonly StateDefinition[];
}

/** Controls which diagnostics will fail an execution in the future runner. */
export interface FailurePolicy {
  readonly consoleError?: boolean | undefined;
  readonly failedRequest?: boolean | undefined;
  readonly pageError?: boolean | undefined;
}

/** The complete user-authored UIWitness configuration contract. */
export interface UIWitnessConfig {
  readonly baseURL: string;
  readonly failOn?: FailurePolicy | undefined;
  readonly routes: readonly RouteDefinition[];
  readonly themes: readonly string[];
  readonly viewports: Readonly<Record<string, ViewportDefinition>>;
}

const identifierPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const identifierMessage =
  "IDs must use lowercase letters or numbers separated by single hyphens.";

const identifierSchema = z.string().regex(identifierPattern, identifierMessage);

function isHttpUrl(value: string): boolean {
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

function isLocalRoutePath(value: string): boolean {
  const referenceBase = new URL("https://uiwitness.invalid");
  try {
    return (
      value.startsWith("/") &&
      new URL(value, referenceBase).origin === referenceBase.origin
    );
  } catch {
    return false;
  }
}

const viewportSchema = z.strictObject({
  height: z.number().int().positive(),
  width: z.number().int().positive(),
});

const stateSchema = z.strictObject({
  id: identifierSchema,
  setup: z.string().refine((value) => value.trim().length > 0, {
    message: "Scenario setup paths cannot be empty.",
  }),
});

function addDuplicateIdIssues(
  values: readonly { readonly id: string }[],
  context: z.RefinementCtx,
  label: "route" | "state",
  pathPrefix: readonly PropertyKey[],
): void {
  const seen = new Set<string>();

  values.forEach((value, index) => {
    if (seen.has(value.id)) {
      context.addIssue({
        code: "custom",
        message: `Duplicate ${label} id "${value.id}".`,
        params: { uiwitnessIssueCode: "duplicate" },
        path: [...pathPrefix, index, "id"],
      });
    }
    seen.add(value.id);
  });
}

const routeSchema = z
  .strictObject({
    id: identifierSchema,
    path: z.string().refine(isLocalRoutePath, {
      message: "Route paths must be local and start with '/'.",
    }),
    states: z.array(stateSchema).min(1, "Routes must declare at least one state."),
  })
  .superRefine((route, context) => {
    addDuplicateIdIssues(route.states, context, "state", ["states"]);
  });

const failurePolicySchema = z.strictObject({
  consoleError: z.boolean().optional(),
  failedRequest: z.boolean().optional(),
  pageError: z.boolean().optional(),
});

const configSchema = z
  .strictObject({
    baseURL: z
      .string()
      .url()
      .refine(isHttpUrl, {
        message: "baseURL must use the http or https protocol.",
      }),
    failOn: failurePolicySchema.optional(),
    routes: z.array(routeSchema).min(1, "Config must declare at least one route."),
    themes: z
      .array(identifierSchema)
      .min(1, "Config must declare at least one theme.")
      .superRefine((themes, context) => {
        const seen = new Set<string>();
        themes.forEach((theme, index) => {
          if (seen.has(theme)) {
            context.addIssue({
              code: "custom",
              message: `Duplicate theme id "${theme}".`,
              params: { uiwitnessIssueCode: "duplicate" },
              path: [index],
            });
          }
          seen.add(theme);
        });
      }),
    viewports: z
      .record(identifierSchema, viewportSchema)
      .refine((viewports) => Object.keys(viewports).length > 0, {
        message: "Config must declare at least one viewport.",
      }),
  })
  .superRefine((config, context) => {
    addDuplicateIdIssues(config.routes, context, "route", ["routes"]);
  });

/**
 * Provides contextual typing for a config module without changing its value.
 * Runtime validation remains explicit through {@link parseConfig}.
 */
export function defineConfig(config: UIWitnessConfig): UIWitnessConfig {
  return config;
}

function formatIssuePath(path: readonly PropertyKey[]): string {
  const propertyPattern = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
  return path.reduce<string>((formatted, segment) => {
    if (typeof segment === "number") {
      return `${formatted}[${segment}]`;
    }
    if (typeof segment === "string" && propertyPattern.test(segment)) {
      return `${formatted}.${segment}`;
    }
    return `${formatted}[${JSON.stringify(String(segment))}]`;
  }, "$");
}

function issueCode(issue: ZodIssue): ConfigValidationIssueCode {
  if (
    issue.code === "custom" &&
    issue.params?.["uiwitnessIssueCode"] === "duplicate"
  ) {
    return "duplicate";
  }
  if (issue.code === "invalid_type") {
    return "invalid_type";
  }
  if (issue.code === "unrecognized_keys") {
    return "unrecognized_key";
  }
  return "invalid_value";
}

function toConfigIssue(issue: ZodIssue): ConfigValidationIssue {
  return Object.freeze({
    code: issueCode(issue),
    message: issue.message,
    path: formatIssuePath(issue.path),
  });
}

/** Parses an unknown value or throws a stable, validator-independent error. */
export function parseConfig(input: unknown): UIWitnessConfig {
  const result = configSchema.safeParse(input);
  if (!result.success) {
    throw new ConfigValidationError(result.error.issues.map(toConfigIssue));
  }
  return result.data;
}
