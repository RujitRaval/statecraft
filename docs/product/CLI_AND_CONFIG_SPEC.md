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
uiwitness scan --coordinate dashboard/success/desktop/light --headed
uiwitness scan --headed
```

`--route` matches one configured route ID exactly and rejects an unknown ID before creating output. `--coordinate` is the atomic `route/state/viewport/theme` selector used by guard reproduction commands; it must resolve to exactly one configured cell and cannot be combined with `--route`. Scenario paths resolve from the selected config's directory, while `.uiwitness/` belongs to the invocation working directory. The summary groups executions by route, reports pass/fail status and coverage from schema-v1 metadata, and prints `.uiwitness/report/index.html`. Each completed scan writes deterministic PNGs, schema-v1 JSON, and the offline HTML report.

### `uiwitness guard`
Run the entire configured matrix once and compare only that fresh in-memory result with a committed state contract.

```bash
uiwitness guard
uiwitness guard --config ./uiwitness.config.mts
uiwitness guard --contract ./contracts/release.json
uiwitness guard --json ./artifacts/contract-verdict.json
```

Guard treats the invocation directory as its workspace and never searches a parent. Config, contract, scenario, and explicit JSON paths must remain beneath that canonical workspace through regular, non-symbolic-link boundaries. The default contract is `uiwitness.contract.json`. The contract schema and comparison truth table are documented in the [core API](../engineering/CORE_API.md).

After validating every input and output boundary, guard runs the complete unfiltered matrix in normal headless mode. It never compares an earlier report. The deterministic machine verdict is written to `.uiwitness/contract-verdict.json`; `--json` requests an additional contained copy and refuses to replace an existing path. Executable regressions, changed known failures, and recovered known failures include an exact shell-safe headed `scan --coordinate` reproduction command. Structural drift deliberately has no coordinate reproduction command.

A matching complete contract exits `0`, including exact active known failures. A complete run with a regression, recovery, expired exception, or unaccepted matrix/config drift exits `1`. Invalid input, unsafe output, setup failure, incomplete execution, or an internal error exits `2`. The current slice publishes the verdict after the runner's existing report transaction; the approved atomic-generation task will bring report, evidence, and contract outputs under one transaction.

### `uiwitness open`
Open latest `.uiwitness/report/index.html`; useful error if absent.

The command accepts no flags or positional arguments. It opens only the fixed HTML report beneath the invocation directory, refuses symbolic-link/non-file report paths, and delegates to the operating system's default browser without a command shell. It never generates or changes report files; the Phase 5 report package owns HTML creation.

## Exit codes
0 the requested check passes or the contract matches; 1 a complete check/scan has failures or a complete guard has contract failures; 2 usage/config/internal/setup/incomplete-run error.

## Coverage
Every `route x state x viewport x theme` is an expected cell. Only configured states count; v0.1 never claims an unconfigured state is missing.
