# CLI and Configuration Specification

## Commands
### `statecraft init`
Create starter config/scenario directory; never silently overwrite; print exact next steps.

The starter is intentionally small:

```text
statecraft.config.ts
statecraft/
  scenarios/
    home/
      success.ts
```

Existing target files cause a setup error. There is no force flag.

### `statecraft scan`
Validate config, optionally filter, execute matrix, write artifacts/report, print summary, return stable exit code.
```bash
statecraft scan
statecraft scan --config ./statecraft.config.ts
statecraft scan --route dashboard
statecraft scan --headed
```

`--route` matches one configured route ID exactly and rejects an unknown ID before creating output. Scenario paths resolve from the selected config's directory, while `.statecraft/` belongs to the invocation working directory. The summary groups executions by route, reports pass/fail status and coverage from schema-v1 metadata, and prints `.statecraft/report/index.html`. Each completed scan writes deterministic PNGs, schema-v1 JSON, and the offline HTML report.

### `statecraft open`
Open latest `.statecraft/report/index.html`; useful error if absent.

The command accepts no flags or positional arguments. It opens only the fixed HTML report beneath the invocation directory, refuses symbolic-link/non-file report paths, and delegates to the operating system's default browser without a command shell. It never generates or changes report files; the Phase 5 report package owns HTML creation.

## Exit codes
0 all configured executions pass; 1 scan completes with failures; 2 config/internal/setup error.

## Coverage
Every `route x state x viewport x theme` is an expected cell. Only configured states count; v0.1 never claims an unconfigured state is missing.
