# ADR 0005: Core configuration validation boundary

## Status

Accepted

## Context

Statecraft configuration is authored as trusted local TypeScript but is still an unknown runtime value when loaded by the future CLI. Phase 2 needs one contract shared by editor typing, runtime validation, matrix planning, and later execution. Callers also need stable error classification without depending on a validation library's internal issue format.

## Decision

- Use Zod 4 as the only runtime dependency of `@statecraft/core`; the implementation specification already selects Zod and it is mature, narrowly scoped, and browser-independent.
- Keep `defineConfig` as an identity helper for contextual typing. Perform explicit runtime validation with `parseConfig` so config authoring does not hide when validation occurs.
- Reject unknown properties and require HTTP(S) base URLs, non-empty routes/states/viewports/themes, positive integer viewport dimensions, slash-prefixed route paths, and non-empty scenario module paths.
- Use lowercase hyphenated IDs for routes, states, themes, and viewport keys. Arbitrary domain vocabulary remains supported within that deterministic filesystem-safe form.
- Translate Zod failures into `ConfigValidationError` with Statecraft-owned error and issue codes plus deterministic property paths. Keep the schema private so callers do not depend on validator-specific composition or error behavior.

## Consequences

The future CLI and matrix planner receive one validated configuration shape. Strict validation catches typos early and deterministic IDs can safely feed later matrix and artifact contracts. `@statecraft/core` gains one production dependency, while Playwright and browser concerns remain outside the package.
