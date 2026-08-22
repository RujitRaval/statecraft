# ADR 0031: Public URL CLI orchestration

- Status: Accepted
- Date: 2026-08-22

## Context

The runner can discover a bounded public route surface and persist the fixed mobile/desktop by light/dark evidence matrix, while the report can present that evidence offline. Users still need one executable workflow that connects those contracts without requiring config or exposing private diagnostics in a terminal.

## Decision

- Add `statecraft check <url> [--max-pages <1-20>] [--headed]` and the programmatic `checkPublicSite(options)` API.
- Require exactly one absolute credential-free HTTP(S) URL. Reject missing, extra, credentialed, relative, and unknown-option input before importing the browser runner.
- Default discovery to its existing five-page budget and accept only explicit integers from 1 through 20.
- Canonicalize the invocation directory before browser work, then pass the immutable discovery result directly into `runPublicSiteChecks` with the same headed launch policy.
- Reuse the runner's existing private transactional PNG/JSON/HTML persistence. Do not create temporary config or scenario modules.
- Return discovery metadata with the validated report and stable project-relative JSON and HTML paths.
- Format terminal output from those contracts: canonical origin, discovered/scanned/skipped counts, per-route fixed-cell results, sanitized assertion failures, aggregate issues, coverage, and report path. Do not print console, page-error, or request diagnostic payloads.
- Preserve the CLI outcome contract: `0` for a completed all-pass check, `1` for a completed check with failed cells, and `2` for usage, discovery, or run-level failure. Expected root/input/discovery failures use stable `CheckError` codes; unexpected details remain hidden.
- Keep `--write-config` and permanent setup generation out of this slice. The truthful adoption prompt points users to `statecraft init` until the separate overwrite-safe promotion slice lands.

## Consequences

One command now turns an authorized live URL into bounded, deterministic local evidence and the kinetic offline report. Quick Check remains honest about its coverage: it sees public success surfaces only and does not claim loading, empty, error, authenticated, or application-specific state coverage.

Discovery and evidence capture each launch through their existing public runner boundary, so this slice uses two short-lived Chromium processes. Sharing one process would couple independent APIs and is deferred unless measurements show a material problem.

The command runs the target site's JavaScript and ordinary requests. It performs no upload or telemetry, strips input query/fragment data before discovery, sanitizes persisted diagnostics through the runner, and must be used only against sites the caller owns or is authorized to test.
