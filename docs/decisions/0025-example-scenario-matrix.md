# ADR 0025: Example Scenario Matrix

## Status

Accepted on 2026-08-20.

## Context

Phase 6 needs one proof that connects the polished example application to the complete Statecraft product path. The proof must cover every meaningful example state across both supported viewports and themes, retain evidence for failed assertions, and fail if either intentional defect disappears or spreads to healthy coordinates. It must not add a special expected-failure concept to the runner or persist generated reports in the repository.

## Decision

Check `statecraft.config.ts` and three route-level scenario modules into `apps/example-nextjs`. Configure 15 route/state combinations: four dashboard states, four orders states, and seven customer states. Expand them across mobile and desktop viewports plus light and dark themes for 60 cells in deterministic configuration order.

Use scenario interception to render non-default states. Each scenario waits for and asserts the intended product-state surface. Orders error cells also assert foreground contrast; customer long-content cells assert document containment. The runner therefore reports four real assertion failures: orders error in dark theme at both viewports, and long customer content at the mobile viewport in both themes. The other 56 cells must pass.

Exercise the matrix through the public CLI in a production-browser integration test. Require exit code `1`, the exact failed coordinates and coverage metrics, non-empty screenshots for every passed and failed cell, schema-v1 JSON, and self-contained HTML. Write the run beneath an isolated temporary project root and delete it after the test.

## Consequences

- Phase 6 proves config discovery, deterministic expansion, scenario loading, isolated execution, screenshots, assertions, result persistence, CLI exit codes, and offline reporting in one gate.
- The four failures remain truthful product failures rather than being converted into passing expected failures.
- A change to the example state inventory or either defect boundary requires an explicit update to the config, assertions, gate, and this decision.
- Generated `.statecraft/` reports remain local, sensitive artifacts and are never committed.
