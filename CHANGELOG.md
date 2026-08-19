# Changelog

All notable changes to Statecraft will be documented in this file.

This project uses the four-part version format required by the GStack ship workflow.

## [0.0.1.0] - 2026-08-19

### For contributors

- Contributors and coding agents now follow a documented branch and pull request workflow with GStack review and ship as required gates.
- Repository checks now catch missing or broken documentation and, once implementation starts, block missing or failing lint, typecheck, test, and build scripts.
- Pull requests now receive CodeQL analysis and dependency review, while Dependabot, code ownership, a pull request template, and security reporting guidance support ongoing maintenance.

### Changed

- The ignore policy now keeps local archives, credentials, reports, browser artifacts, caches, logs, editor files, and agent state out of the public repository.
- Repository entry points now keep implementation work inside the approved Phase 1 and Phase 2 boundary.
