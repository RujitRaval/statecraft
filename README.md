# Statecraft Project Documentation

Statecraft is an open-source UI product-state coverage tool: **find, render, and report the UI states your product forgot.**

This folder is the implementation source of truth intended to be handed to Codex.

Phase 1 provides the pnpm and strict TypeScript foundation. Product behavior begins in Phase 2 with the `@statecraft/core` contracts.

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
- Engineering: [security and privacy](docs/engineering/SECURITY_PRIVACY.md)
- Architecture decisions: [product-state coverage](docs/decisions/0001-product-state-coverage.md), [local deterministic core](docs/decisions/0002-local-deterministic-core.md), [Playwright runner](docs/decisions/0003-playwright-runner.md), and [Phase 1 toolchain](docs/decisions/0004-phase-1-toolchain.md)
- Open source: [contributing plan](docs/open-source/CONTRIBUTING_PLAN.md)

## Governing workflow
`configure -> scan -> inspect report -> identify broken states`

Do not expand scope until this local-first v0.1 workflow is excellent.

## Development

Read [AGENTS.md](AGENTS.md) before making changes. Every development step starts from `main`, uses a focused branch, runs GStack `review`, and is published through GStack `ship` as a pull request. See [CONTRIBUTING.md](CONTRIBUTING.md) for the full workflow.

Statecraft requires Node.js 22.20 or newer within the Node 22 LTS line, or Node.js 24 and newer, and uses the pnpm version pinned in `package.json`:

```bash
corepack pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Phase 1 creates only `packages/core`. The CLI, Playwright runner, report, and example application packages are added when their implementation phases begin.
