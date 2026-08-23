# ADR 0033: Registry-only public URL consumer gate

## Status
Accepted

## Context
The Public URL Quick Check journey spans npm installation, browser provisioning, bounded discovery, persisted evidence, overwrite-safe project promotion, generated module imports, and configured scanning. Workspace and packed-tarball tests prove candidate artifacts, but neither proves that a newly published consumer can complete the launch journey from the public registry.

## Decision
- Add a dependent post-publication release job that accepts the exact GitHub Release tag and installs `statecraft-ui` plus the runner manifest's exact Playwright version into an empty `npm init -y` project from the explicit npmjs registry. Treat both an omitted `type` field and npm 11's explicit `"type": "commonjs"` as valid CommonJS consumer shapes.
- Give the job an independent 25-minute budget and provision browser system dependencies there. Retry only registry propagation, transient network failures, and install timeouts within one bounded ten-minute elapsed-time window. Force online metadata revalidation with a distinct temporary npm cache on every attempt. Permanent npm and process errors fail immediately.
- Serve a deterministic two-page loopback fixture owned by the gate. Run evidence-only `check`, execute its exact printed `check --write-config` command, then run the untouched generated `scan` with the installed CLI binary.
- Require the exact eight-cell route × public-state × viewport × theme coordinates, all-pass summaries, non-empty in-boundary screenshots, schema-v1 JSON, kinetic offline HTML, and unchanged generated source after scan.
- Run the gate after publishing all four packages. It verifies public availability and dependency resolution; it does not replace the pre-publication package and repository gates.

## Consequences
- A green Release workflow now proves the documented first-use path with registry artifacts rather than only repository or tarball artifacts.
- Publication has already happened if this final check fails, so the release is visible but not launch-ready until the problem is fixed and the workflow or a follow-up release passes.
- The proof downloads packages and may provision Chromium, so it remains release-only rather than part of pull-request CI.
- Delayed package visibility cannot poison every retry through one npm cache, and the gate remains bounded without depending on a fresh-runner rerun.
- The loopback fixture exercises public URL behavior deterministically without scanning a third-party site or retaining user data.
