# ADR 0026: Release CI Smoke

## Status

Accepted on 2026-08-21.

## Context

The workspace suite proves package behavior, but a release gate must also prove the clean-checkout path another developer follows: locked installation, browser installation, production build, a separately spawned CLI process, application readiness, scan exit semantics, and inspectable report output. The example intentionally contains four failures, so treating any nonzero scan as a broken release would make the proof unusable; treating every nonzero scan as success would hide setup errors and failure drift.

## Decision

Add a dedicated `Release Smoke` GitHub Actions job. From a fresh checkout it performs a frozen workspace install, installs the pinned Chromium build, builds all packages and the production example, then runs `scripts/release-smoke.mjs` from a unique operating-system temporary project root.

The smoke script starts the production example on an allocated loopback port, resolves the `statecraft` executable through `@statecraft/cli`'s declared package `bin` target, and invokes it as a bounded child process rather than importing its programmatic API. It validates JSON through the built core package's canonical schema-v1 parser, then accepts only exit code `1`, exactly 56 passes and four known assertion failures at their approved coordinates, 60 non-empty screenshots, the established coverage totals, and offline HTML. Exit code `0`, exit code `2`, timeout, changed failure coordinates, missing evidence, or a screenshot path outside the generated project all fail the job.

Upload the complete fictional `.statecraft` evidence bundle for seven days with an explicitly pinned `actions/upload-artifact` step that includes the hidden directory and runs even after failure. Document the normal consumer workflow separately: a product scan with failures remains a failing CI step, while `if: always()` preserves its report and screenshot assets for diagnosis. Label that external workflow as pre-publication until package metadata ships.

## Consequences

- A clean checkout now proves the executable consumer path separately from the workspace test harness.
- The intentional example defects remain exact release fixtures without weakening the public `0`/`1`/`2` exit contract.
- Local smoke output uses a unique owned temporary directory and is removed after verification; CI preserves its fictional `.statecraft` bundle only for artifact upload.
- Artifact upload is an explicit repository choice, not Statecraft telemetry; user documentation includes retention and sensitive-data guidance.
