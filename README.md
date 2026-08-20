# Statecraft Project Documentation

Statecraft is an open-source UI product-state coverage tool: **find, render, and report the UI states your product forgot.**

This folder is the implementation source of truth intended to be handed to Codex.

Phase 1 provides the pnpm and strict TypeScript foundation. Phase 2 completes the browser-independent `@statecraft/core` contracts. Phase 3 completes the programmatic `@statecraft/runner-playwright` path: isolated browser lifecycles, deterministic navigation/readiness, screenshots, sanitized diagnostics, assertions, result translation, and private local artifact/report persistence. Phase 4 completes deterministic config discovery/loading plus overwrite-safe `statecraft init`, scan orchestration, and safe latest-report opening. Phase 5 completes the real `@statecraft/report` package with deterministic transformation, self-contained offline HTML, route/state/viewport/theme/status filters, and an accessible evidence inspector. Phase 6 is active and begins with the polished, deterministic Northline commerce operations example application.

## Start here
1. [Master prompt](codex/MASTER_PROMPT.md)
2. [Implementation specification](codex/IMPLEMENTATION_SPEC.md)
3. [Product requirements](docs/product/PRD.md)
4. [Architecture](docs/architecture/ARCHITECTURE.md)
5. [Implementation plan](docs/engineering/IMPLEMENTATION_PLAN.md)
6. [Test strategy](docs/engineering/TEST_STRATEGY.md)
7. [Launch strategy](docs/open-source/LAUNCH_STRATEGY.md)

## Documentation map

- Project guidance: [agent guide](AGENTS.md), [Claude guidance](CLAUDE.md), [phase checklist](codex/PHASE_CHECKLIST.md), [contributing](CONTRIBUTING.md), [security policy](SECURITY.md), and [changelog](CHANGELOG.md)
- Product: [CLI and configuration](docs/product/CLI_AND_CONFIG_SPEC.md) and [report UX](docs/product/REPORT_UX_SPEC.md)
- Engineering: [`@statecraft/core` API](docs/engineering/CORE_API.md), [Playwright runner API](docs/engineering/RUNNER_API.md), [report API](docs/engineering/REPORT_API.md), [CLI API](docs/engineering/CLI_API.md), and [security and privacy](docs/engineering/SECURITY_PRIVACY.md)
- Architecture decisions: [product-state coverage](docs/decisions/0001-product-state-coverage.md), [local deterministic core](docs/decisions/0002-local-deterministic-core.md), [Playwright runner](docs/decisions/0003-playwright-runner.md), [Phase 1 toolchain](docs/decisions/0004-phase-1-toolchain.md), [core configuration validation](docs/decisions/0005-core-config-validation.md), [deterministic matrix planning](docs/decisions/0006-core-matrix-planner.md), [deterministic artifact paths](docs/decisions/0007-deterministic-artifact-paths.md), [configured-state coverage](docs/decisions/0008-configured-state-coverage.md), [versioned result/report contracts](docs/decisions/0009-versioned-result-report-contracts.md), [runner execution lifecycle](docs/decisions/0010-runner-execution-lifecycle.md), [runner scenario loading and hooks](docs/decisions/0011-runner-scenario-loading-hooks.md), [runner navigation and readiness](docs/decisions/0012-runner-navigation-readiness.md), [runner capture, diagnostics, and assertions](docs/decisions/0013-runner-capture-diagnostics-assertions.md), [runner result persistence](docs/decisions/0014-runner-result-persistence.md), [CLI config discovery](docs/decisions/0015-cli-config-discovery.md), [CLI initialization](docs/decisions/0016-cli-init.md), [CLI scan orchestration](docs/decisions/0017-cli-scan-orchestration.md), [CLI latest-report opening](docs/decisions/0018-cli-open.md), [offline report foundation](docs/decisions/0019-report-offline-html.md), [offline report interaction](docs/decisions/0020-report-interactive-filters.md), and [example application foundation](docs/decisions/0021-example-application-foundation.md)
- Open source: [contributing plan](docs/open-source/CONTRIBUTING_PLAN.md)

## Governing workflow
`configure -> scan -> inspect report -> identify broken states`

Do not expand scope until this local-first v0.1 workflow is excellent.

## Development

Read [AGENTS.md](AGENTS.md) before making changes. Every development step starts from `main`, uses a focused branch, runs GStack `review`, and is published through GStack `ship` as a pull request. See [CONTRIBUTING.md](CONTRIBUTING.md) for the full workflow.

Statecraft requires Node.js 22.20 or newer within the Node 22 LTS line, or Node.js 24.x, and uses the pnpm version pinned in `package.json`:

```bash
corepack pnpm install --frozen-lockfile
corepack pnpm --filter @statecraft/runner-playwright exec playwright install chromium
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build
```

The workspace contains `packages/core`, `packages/runner-playwright`, `packages/report`, `packages/cli`, and the Phase 6 `apps/example-nextjs` fixture.
