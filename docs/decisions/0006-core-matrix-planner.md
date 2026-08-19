# ADR 0006: Deterministic core matrix planner

## Status

Accepted

## Context

Every configured route, state, viewport, and theme combination is an expected Statecraft execution. Phase 2 needs a browser-independent way to enumerate and select those coordinates before the runner, artifact, and report contracts exist. The order must remain stable so later execution and reporting are reproducible.

## Decision

- Add `expandMatrix` to `@statecraft/core`. It accepts a validated `StatecraftConfig` and returns one `MatrixCell` per Cartesian-product coordinate.
- Preserve route, state, and theme declaration order. Viewports follow ECMAScript property order, which is deterministic and enumerates integer-like keys numerically before other keys. Filters select from that sequence rather than imposing their own order.
- Represent filters as optional arrays of route IDs, state IDs, viewport IDs, and themes. Omitted dimensions select all values; empty or unmatched selections produce no cells; duplicates do not duplicate output.
- Keep selection exact and side-effect free. The planner does not validate CLI flags, load scenarios, access files, derive artifact paths, or know about Playwright and reports.
- Carry the complete route, state, viewport, viewport ID, and theme on every cell. This matches the data a later scenario context needs without introducing browser types.

## Consequences

The runner and CLI can consume one deterministic matrix contract, and a route filter can be implemented without duplicating expansion logic. State IDs remain scoped to their configured routes; a state filter selects every matching state ID under the selected routes. User-facing errors for unmatched CLI filters remain a CLI responsibility. Artifact identity and paths remain a separate Phase 2 decision.
