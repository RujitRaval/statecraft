# ADR 0008: Deterministic configured-state coverage

## Status

Accepted

## Context

Statecraft needs four coverage metrics before the Playwright runner and versioned report contracts exist. Coverage must use explicit configured cells as its denominator, never infer missing product states, and remain stable when executions are missing, duplicated, reordered, or unrelated to the selected matrix.

## Decision

- Add `calculateCoverage(cells, observations)` to `@statecraft/core`. The supplied matrix defines the complete configured execution set; observations provide only exact route, state, viewport, and theme coordinates plus whether that execution passed.
- Return execution, state, responsive, and theme `CoverageMetric` values. Each metric carries `covered`, `total`, and a percentage rounded to at most two decimal places.
- Count a route/state pair as state-covered after any successful render. Count it as responsive-covered when every configured viewport has at least one successful render across its themes. Count it as theme-covered when every configured theme has at least one successful render across its viewports.
- Treat missing observations as uncovered and ignore observations outside the configured matrix. Collapse duplicate configured coordinates. Collapse duplicate observations conservatively: a coordinate passes only if every observation for it passed.
- Return zero for all empty-matrix values rather than producing `NaN` or claiming full coverage. Keep route/state identity route-scoped and coordinate matching exact and case-sensitive.
- Keep the input independent of execution-result and report schemas. Later contracts can project their records into the minimal `CoverageObservation` shape without making coverage math depend on diagnostics, serialization, Playwright, or UI concerns.

## Consequences

Coverage is deterministic, order-independent, and resistant to inflated numerators from duplicated or unconfigured results. Responsive and theme coverage remain useful distinct signals instead of both reducing to all-cells-passed. Callers measuring a filtered matrix get coverage for that explicit selection. Result/report contracts remain free to evolve as their own Phase 2 step while reusing the stable coverage projection.
