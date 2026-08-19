# Statecraft Project Documentation

Statecraft is an open-source UI product-state coverage tool: **find, render, and report the UI states your product forgot.**

This folder is the implementation source of truth intended to be handed to Codex.

The repository currently contains the approved product and engineering specifications. Implementation begins with Phase 1 and Phase 2 only.

## Start here
1. `codex/MASTER_PROMPT.md`
2. `codex/IMPLEMENTATION_SPEC.md`
3. `docs/product/PRD.md`
4. `docs/architecture/ARCHITECTURE.md`
5. `docs/engineering/IMPLEMENTATION_PLAN.md`
6. `docs/engineering/TEST_STRATEGY.md`
7. `docs/open-source/LAUNCH_STRATEGY.md`

## Governing workflow
`configure -> scan -> inspect report -> identify broken states`

Do not expand scope until this local-first v0.1 workflow is excellent.

## Development

Read [AGENTS.md](AGENTS.md) before making changes. Every development step starts from `main`, uses a focused branch, runs GStack `review`, and is published through GStack `ship` as a pull request. See [CONTRIBUTING.md](CONTRIBUTING.md) for the full workflow.
