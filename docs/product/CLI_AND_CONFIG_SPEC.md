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

### `statecraft open`
Open latest `.statecraft/report/index.html`; useful error if absent.

## Exit codes
0 all configured executions pass; 1 scan completes with failures; 2 config/internal/setup error.

## Coverage
Every `route x state x viewport x theme` is an expected cell. Only configured states count; v0.1 never claims an unconfigured state is missing.
