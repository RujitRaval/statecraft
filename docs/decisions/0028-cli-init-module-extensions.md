# ADR 0028: Module-unambiguous CLI starter extensions

## Status

Accepted

## Context

`npm init -y` creates a package without `"type": "module"`, so Node treats `.ts` files in that project as CommonJS. Statecraft previously generated ESM syntax in `statecraft.config.ts` and `statecraft/scenarios/home/success.ts`. The published quick start therefore failed at config import in a clean npm project before Chromium launched.

Statecraft supports Node.js 22.20+ and Node.js 24, where `.mts` identifies an ESM TypeScript module independently of the nearest package type. Config discovery already accepts `.mts`, and scenario loading imports the configured module URL directly.

## Decision

- Generate `statecraft.config.mts` and `statecraft/scenarios/home/success.mts`.
- Point the generated config at the `.mts` scenario.
- Keep all existing config extensions discoverable. Existing `.ts`, `.js`, `.mjs`, `.cts`, and `.cjs` projects remain supported according to their normal Node module rules.
- Exercise the packed CLI from a literal `npm init -y` consumer, then run the generated starter through a real four-cell Chromium scan and verify its PNG, JSON, and offline HTML output.

This supersedes only the generated-file extension choice in ADR 0016. Its overwrite, race, ordering, and recovery decisions remain unchanged.

## Consequences

Fresh CommonJS-default and ESM npm projects can use `statecraft init` without adding `"type": "module"`. The `.mts` suffix makes the intended module format explicit to Node and TypeScript. Users upgrading an existing generated `.ts` setup do not need to rename it when their project already supplies compatible module semantics.
