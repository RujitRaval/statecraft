# Statecraft Agent Guide

## Source of truth

Before changing implementation code, read these files in order:

1. `codex/MASTER_PROMPT.md`
2. `codex/IMPLEMENTATION_SPEC.md`
3. `docs/product/PRD.md`
4. `docs/architecture/ARCHITECTURE.md`
5. `docs/engineering/IMPLEMENTATION_PLAN.md`
6. `docs/engineering/TEST_STRATEGY.md`
7. `docs/engineering/SECURITY_PRIVACY.md`

The current implementation boundary is Phase 1 and Phase 2. Do not begin the Playwright runner, report UI, or other later phases until the user explicitly advances the phase.

## Development workflow

Every development step after the repository bootstrap must follow this sequence:

1. Start from an up-to-date, clean `main` branch.
2. Create a focused branch named `feat/<slug>`, `fix/<slug>`, `chore/<slug>`, `docs/<slug>`, `test/<slug>`, or `refactor/<slug>`.
3. Implement one coherent development step and its tests. Keep the branch inside the approved phase and scope.
4. Run the repository checks locally.
5. Run the GStack `review` skill and resolve its findings.
6. Run the GStack `ship` skill. Let it verify, version, update the changelog, commit, push, and open or update the pull request.
7. Merge only through a green pull request. Never push implementation work directly to `main` and never force-push.

The initial documentation import on `main` is the one bootstrap exception because no base branch existed yet.

## Required checks

Once `package.json` exists, the root package must provide `lint`, `typecheck`, `test`, and `build` scripts. CI treats any missing script as a failure.

Before handoff, run:

```bash
node scripts/check-docs.mjs
node --test scripts/*.test.mjs
node scripts/run-ci.mjs
```

Run `corepack pnpm install --frozen-lockfile` first when dependencies are present.

## Engineering constraints

- Keep the core local-first and deterministic. No telemetry, hosted backend, account, database, cloud dependency, or required LLM.
- Add tests with each capability and regression fix.
- Keep public APIs small and documented.
- Record material architecture decisions in `docs/decisions/`.
- Do not commit `.statecraft/` because reports may contain screenshots and sensitive application data.
- Justify major dependencies and prefer mature, narrowly scoped packages.
