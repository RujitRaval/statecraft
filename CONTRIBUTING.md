# Contributing to Statecraft

Statecraft is currently in its Phase 1 and Phase 2 foundation work. Read `AGENTS.md`, `codex/IMPLEMENTATION_SPEC.md`, and the relevant documents under `docs/` before changing code.

## Branch and pull request workflow

1. Update your local base:

   ```bash
   git switch main
   git pull --ff-only origin main
   ```

2. Create a focused branch:

   ```bash
   git switch -c feat/short-description
   ```

3. Implement one coherent step with tests and documentation.
4. Use Node.js 22.20 or newer within the Node 22 LTS line, or Node.js 24 and newer, and install the locked dependencies:

   ```bash
   corepack pnpm install --frozen-lockfile
   ```

5. Run the local checks:

   ```bash
   pnpm lint
   pnpm typecheck
   pnpm test
   pnpm build
   node scripts/check-docs.mjs
   node scripts/run-ci.mjs
   ```

6. Run GStack `review` and resolve the findings.
7. Run GStack `ship` to perform final verification, versioning, changelog updates, commits, push, and pull request creation.

Direct pushes and force-pushes to `main` are not part of the project workflow. Pull requests must pass all required checks and resolve review conversations before merge.

## Change requirements

- Keep work inside the current phase and the pull request's stated scope.
- Add tests for behavior changes and bug fixes.
- Document public API changes and consider JSON schema compatibility.
- Add or update an ADR for material architecture decisions.
- Explain new dependencies in the pull request.
- Never commit generated `.statecraft/` reports or secrets.

## Commit and pull request quality

Keep commits coherent and bisectable. Pull requests should explain the user-visible outcome, tests run, scope boundaries, security or privacy effects, and any follow-up work.
