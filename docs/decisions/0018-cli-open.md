# ADR 0018: Safe latest-report opening

## Status

Accepted

## Context

Phase 4 needs `statecraft open` before the Phase 5 report generator exists. The CLI should define how the latest offline report is located and launched without taking ownership of HTML generation, adding a runtime dependency, or passing project-controlled paths through a command shell.

## Decision

- Treat `.statecraft/report/index.html` beneath the invocation directory as the single latest-report contract.
- Canonicalize and validate the project root, require real `.statecraft/` and `report/` directories plus a readable regular `index.html`, and reject symbolic-link boundaries.
- Launch with a shell-free argument array using absolute system paths for macOS `open`, Windows `explorer.exe`, or freedesktop `xdg-open` elsewhere, so the project directory cannot supply a replacement launcher binary.
- Treat the local project/report directory as trusted against concurrent same-user mutation during the pathname-based operating-system handoff; these launchers cannot accept a pinned file descriptor.
- Expose `openReport` with stable missing, invalid-root, invalid-path, and launch-failure codes. The executable accepts no `open` arguments, prints the stable project-relative path on success, and returns exit code `2` for expected or unexpected failures.
- Never create, parse, rewrite, or bundle HTML in the CLI. Phase 5 remains responsible for report transformation and offline UI generation.

## Consequences

The CLI command contract is complete and testable before the report UI exists. Projects receive predictable local-only behavior and useful missing-report errors, while the Phase 5 report package can publish the agreed fixed path without coupling its rendering architecture to operating-system launch logic.
