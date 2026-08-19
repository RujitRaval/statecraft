# ADR 0009: Versioned result and report contracts

## Status

Accepted

## Context

The future Playwright runner and report package need one browser-independent handoff. The JSON report is an external contract from its first release, so malformed records, unsupported versions, unsafe artifact references, and internally inconsistent summaries must fail before they reach report rendering or downstream automation.

## Decision

- Define a strict `schemaVersion: 1` report envelope containing generation time, project base URL, summary metrics, and execution records. The schema version governs the nested execution-record shape.
- Persist explicit route, state, viewport, theme, URL, scenario source, duration, status, screenshot path, failures, and diagnostics for every execution. Never infer metadata from artifact filenames.
- Keep diagnostics browser-independent and intentionally narrow. Failed-request records contain only URL, method, and sanitized error text; headers, cookies, request/response bodies, and other unknown properties are rejected. At every parsing and serialization boundary, remove URL credentials and fragments and replace every query value with `[REDACTED]` while retaining its key.
- Require pass/failure records to be coherent. Passed executions have a screenshot and no failures; failed executions have at least one stable failure code and may retain a screenshot captured before or after the failure.
- Validate serialized screenshot paths by recomputing the deterministic artifact path from explicit execution metadata. A validated path can then safely regain the opaque `ScreenshotArtifactPath` type.
- Validate report summaries against their records: coordinates are unique; shared route, state, and viewport metadata is consistent; route, state, execution, pass, failure, and duration totals agree; and all four coverage metrics equal `calculateCoverage` output.
- Expose Statecraft-owned `parseExecutionResult`, `parseReport`, and `serializeReport` functions and stable validation errors. Keep the underlying Zod schemas private so validator internals do not become public API.
- Serialize as deterministic two-space-indented, newline-terminated JSON. The caller supplies `generatedAt`; the core never reads the clock or filesystem.

## Consequences

Runner, CLI, report UI, and external consumers share one strict handoff that detects corruption and schema drift early. Reports cannot accidentally persist common sensitive request fields or raw URL query values, though the future runner must still sanitize every diagnostic string before constructing a result. This intentionally hides benign query values as the cost of making the public artifact safe by default. Relational validation costs a linear pass over execution records, which is appropriate for local report generation. Any incompatible future shape requires a new schema version and explicit parser support rather than silently changing version 1.
