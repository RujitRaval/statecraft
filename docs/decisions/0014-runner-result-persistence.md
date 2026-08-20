# ADR 0014: Runner result translation and private local persistence

## Status

Accepted

## Context

The final Phase 3 step must convert browser capture outcomes into the existing browser-independent result/report contracts and persist sensitive screenshots without introducing CLI or report-rendering responsibilities. A failed cell can still have useful screenshot evidence, repeated runs must not leave stale artifacts, and partial filesystem publication must not make an old report appear current.

## Decision

- Add `runPersistedScenarioCells` as the complete programmatic Phase 3 entry point. It calls the in-memory capture runner, translates every settled cell into a validated core `ExecutionResult`, builds a validated schema-v1 `StatecraftReport`, persists the run, and returns the report plus its stable project-relative JSON path.
- Use `screenshotArtifactPath(cell)` for every available screenshot. Passed cells always persist a PNG; failed cells persist one when capture completed before a later assertion, diagnostic-policy, or hook failure. A screenshot-capture failure and an unexpected lifecycle failure use `null`.
- Persist `.statecraft/artifacts/` as a staged replacement tree so removed or filtered cells cannot leave stale runner artifacts. Hide the prior JSON before replacing artifacts, then publish `.statecraft/report/statecraft.json` last. Preserve other files in `.statecraft/report/` for the later report UI phase. Rollback restores artifacts before exposing the previous JSON and preserves recovery data if restoration is incomplete.
- Resolve an existing project directory, prevalidate individual and cross-cell report invariants before Chromium launches, reject symbolic-link artifact and JSON targets, keep staging and lock state inside the ignored `.statecraft/` root, and normalize owner-only directory/file modes where the platform supports them. A process-owned local lock with immutable ownership, append-only phase markers, and durable stale-owner takeover claims covers capture and publication so concurrent runs cannot interleave one artifact tree and another report; abandoned pre-publication locks and staging are recoverable without discarding publishing/recovery state.
- Accept an optional `generatedAt: Date` for deterministic integration tests; otherwise record completion time. Validate every result and the complete report through the existing core parsers before filesystem publication.
- Treat filesystem setup/publication failures as run-level failures. Browser and scenario failures remain per-cell execution results, so one failed state does not remove unrelated evidence.

## Consequences

Phase 3 now has a complete programmatic path from matrix cells to deterministic PNG artifacts and versioned JSON data. The runner owns execution and local persistence but not configuration discovery, terminal UX, exit codes, HTML generation, report assets, or opening a report. Those remain explicitly deferred until the user advances the phase.
