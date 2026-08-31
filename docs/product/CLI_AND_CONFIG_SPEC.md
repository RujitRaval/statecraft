# CLI and Configuration Specification

## Commands
### `uiwitness init`
Create starter config/scenario directory; never silently overwrite; print exact next steps.

The starter is intentionally small:

```text
uiwitness.config.mts
uiwitness/
  scenarios/
    home/
      success.mts
```

Existing target files cause a setup error. There is no force flag.

### `uiwitness check <url>`
Discover a bounded public surface, execute a fixed responsive/theme matrix, persist evidence, and print a page-level verdict without requiring config.

```bash
uiwitness check https://example.com
uiwitness check https://example.com --max-pages 12
uiwitness check https://example.com --headed
uiwitness check https://example.com --write-config
```

The URL must be absolute HTTP(S) and contain no credentials. Discovery removes its query and fragment, follows same-origin HTML pages in deterministic first-seen order, attempts at most five pages by default, and accepts an explicit integer budget from 1 through 20. Each accepted page receives exactly four checks: mobile `390x844` light/dark and desktop `1440x900` light/dark. HTTP errors, missing main-document responses, uncaught page errors, and horizontal overflow greater than one CSS pixel fail a cell; sanitized console and subordinate-request diagnostics remain warning evidence.

The summary reports canonical site, discovered/scanned/skipped counts, per-page failures, issue totals, coverage, and `.uiwitness/report/index.html`. It prints no raw diagnostic payloads. Without `--write-config`, it prints the exact command that promotes the canonical discovered surface. With `--write-config`, it preflights every supported config and generated path before browser work, persists evidence, then exclusively publishes the shared scenario and config-last entrypoint. A completed all-pass check exits `0`; a completed check with failed cells exits `1`; invalid usage, discovery failure, setup conflict/write failure, or a run-level failure exits `2`.

### `uiwitness scan`
Validate config, optionally filter, execute matrix, write artifacts/report, print summary, return stable exit code.
```bash
uiwitness scan
uiwitness scan --config ./uiwitness.config.mts
uiwitness scan --route dashboard
uiwitness scan --headed
```

`--route` matches one configured route ID exactly and rejects an unknown ID before creating output. Scenario paths resolve from the selected config's directory, while `.uiwitness/` belongs to the invocation working directory. The summary groups executions by route, reports pass/fail status and coverage from schema-v1 metadata, and prints `.uiwitness/report/index.html`. Each completed scan writes deterministic PNGs, schema-v1 JSON, and the offline HTML report.

### `uiwitness open`
Open latest `.uiwitness/report/index.html`; useful error if absent.

The command accepts no flags or positional arguments. It opens only the fixed HTML report beneath the invocation directory, refuses symbolic-link/non-file report paths, and delegates to the operating system's default browser without a command shell. It never generates or changes report files; the Phase 5 report package owns HTML creation.

## Exit codes
0 all checks/executions pass; 1 check or scan completes with failures; 2 usage/config/internal/setup error.

## Coverage
Every `route x state x viewport x theme` is an expected cell. Only configured states count; v0.1 never claims an unconfigured state is missing.
