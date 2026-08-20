# ADR 0013: Runner capture, diagnostics, assertions, and failure policy

## Status

Accepted

## Context

Phase 3 needs to turn a ready page into evidence while preserving cell isolation and the existing browser-independent result contract. Diagnostics may contain credentials or tokens, screenshots can contain sensitive application data, and nonfatal browser noise must not make the default scan unusable. Artifact persistence and result construction are a separate concern and remain outside this slice.

## Decision

- Add `runCapturedScenarioCells` as the high-level in-memory capture stage. Attach listeners before theme setup and scenario hooks, then reuse the established navigation/readiness lifecycle.
- Capture a viewport-sized PNG into owned memory after deterministic readiness and before running the optional scenario `assert` hook. Do not accept an output path or write files.
- Return navigation metadata, integer duration, assertion status, PNG bytes, and diagnostics shaped like the core `ExecutionDiagnostics` contract.
- Capture console errors, uncaught page errors, and failed HTTP(S) requests. Failed-request records contain only sanitized URL, method, and error text; headers, cookies, bodies, and JavaScript argument handles are never read.
- Remove URL credentials and fragments, preserve query keys while replacing values with `[REDACTED]`, redact authorization, cookie, bearer, and named-secret forms in free-form text, and cap diagnostic strings at 2,000 characters. Retain at most 100 entries per category and expose dropped-entry counts. Public error causes are sanitized copies rather than original throwables.
- Treat page errors as fatal by default. Console errors and failed requests are recorded but nonfatal by default. Allow callers to override those three categories with the existing `FailurePolicy`. Screenshot and assertion failures always fail the cell.
- Reject capture-stage failures after page creation with `ScenarioCaptureError`, whose stable core-compatible failure codes and partial in-memory evidence let later result construction retain diagnostics, response status, same-origin navigation metadata, and any successful screenshot. Cross-origin redirects retain status but no external URL metadata. Route and scenario setup run inside this structured boundary; generic browser context/page setup and cleanup retain the lower-level lifecycle error contract. Continue with unrelated cells through the existing settled lifecycle.

## Consequences

The runner now owns evidence collection and failure semantics without introducing storage, CLI, or report dependencies. The next Phase 3 slice can translate fulfilled captures and `ScenarioCaptureError` evidence into versioned execution results and deterministic artifact paths. Sanitization is intentionally defensive rather than a guarantee that arbitrary application-authored messages cannot contain novel secret formats, so users must still treat capture output as sensitive local data.
