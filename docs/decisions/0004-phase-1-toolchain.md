# ADR 0004: Phase 1 toolchain and package boundary

## Status

Accepted

## Context

Phase 1 needs a repeatable TypeScript workspace with strict checks while the implementation remains limited to the foundation. The architecture names four eventual packages, but the specification also prohibits empty future packages.

## Decision

- Use a pnpm workspace pinned by version and integrity hash through Corepack. Support Node.js 22 from 22.20 onward so runtime and type declarations share a floor, and support Node.js 24.x. Exclude Node.js 23 and Node.js 25+, where the current toolchain contract does not apply and Corepack is no longer bundled.
- Use TypeScript 6.0, ESLint 10 with TypeScript ESLint and Node globals, and Vitest 4 as development-only tooling.
- Keep dependency versions exact, quarantine releases for one day by default, and enforce peer dependency and engine compatibility during explicit installs. Disable pnpm's implicit pre-script install so checks never mutate dependencies or prompt for input.
- Create only `@statecraft/core` because Phase 2 implements it next. Keep it private until its public contracts are ready.
- Build packages with `tsc` and native ESM. Keep the shared package configuration free of browser globals, and let future browser packages opt into DOM types explicitly. Avoid a bundler until a package has a demonstrated bundling requirement.
- Keep runtime dependencies at zero in Phase 1.

## Consequences

Fresh installs, builds, checks, and tests are deterministic from the lockfile. Later package directories will be added with their real implementations rather than as placeholders. TypeScript 6.0 is pinned instead of TypeScript 7.0 because the current TypeScript ESLint release does not yet support TypeScript 7.
