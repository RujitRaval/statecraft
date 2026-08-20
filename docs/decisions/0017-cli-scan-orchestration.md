# ADR 0017: Deterministic CLI scan orchestration

## Status

Accepted

## Context

Phase 4 needs a user-facing path from trusted configuration to the completed Phase 3 runner without copying matrix, persistence, or report semantics into the CLI. Route filtering must be predictable, scenario paths and output roots need explicit ownership, and a completed scan with failed cells must remain distinguishable from setup failure. HTML generation and report opening belong to later slices.

## Decision

- Add `statecraft scan` with dependency-free parsing for `--config <path>`, one exact `--route <id>`, and `--headed`.
- Add `scanProject` as the small programmatic orchestration boundary. It composes `loadConfig`, `expandMatrix`, and `runPersistedScenarioCells` and returns the validated report plus its stable project-relative JSON path.
- Resolve scenario modules from the selected config's directory and root `.statecraft/` at the invocation working directory.
- Reject an unknown route before browser launch or output creation. Do not silently run an empty matrix or use substring matching.
- Format terminal summaries only from versioned report metadata. Return `0` for an all-pass completed scan, `1` for a completed scan with failures, and `2` for usage, configuration, setup, or run-level errors.
- Keep PNG and schema-v1 JSON persistence in the existing runner. Defer `open`, HTML generation, and report UI work.

## Consequences

The executable now offers a complete local path from configuration through deterministic browser evidence and machine-readable results. Core planning and runner persistence remain independently testable sources of truth, while the CLI owns only selection, presentation, and process semantics. One CLI runtime dependency on the existing Playwright runner is intentional; no parser, telemetry, network service, or report dependency is added. Phase 4 remains open until report-opening behavior and its acceptance gate are completed.
