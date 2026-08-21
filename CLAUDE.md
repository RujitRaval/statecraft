# Statecraft

Follow `AGENTS.md`, `DESIGN.md`, and the specification files under `codex/` and `docs/`. Phase 1 through Phase 7 are complete. Keep future work in an explicitly approved roadmap slice.

## Skill routing

When the user's request matches an available skill, invoke it. When in doubt, invoke the skill.

Key routing rules:

- Product ideas or brainstorming: `/office-hours`
- Strategy or scope: `/plan-ceo-review`
- Architecture: `/plan-eng-review`
- Design system or plan review: `/design-consultation` or `/plan-design-review`
- Full review pipeline: `/autoplan`
- Bugs or errors: `/investigate`
- QA or site behavior: `/qa` or `/qa-only`
- Code review or diff check: `/review`
- Visual polish: `/design-review`
- Ship, deploy, or pull request: `/ship` or `/land-and-deploy`
- Save progress: `/context-save`
- Resume context: `/context-restore`
- Backlog-ready specification or issue: `/spec`

## Git policy

All development work starts from `main`, uses a focused branch, passes GStack review, and lands through a pull request. Never push implementation work directly to `main` and never force-push.

## Testing

Use Node.js 22.20 or newer within the Node 22 line, or Node.js 24.x. Install dependencies with `corepack pnpm install --frozen-lockfile`, then install the pinned runner browser with `corepack pnpm --filter statecraft-ui-runner-playwright exec playwright install chromium`. Run `corepack pnpm lint`, `corepack pnpm typecheck`, `corepack pnpm test`, and `corepack pnpm build` for each development step. Vitest covers TypeScript packages, while Node's built-in test runner covers the repository check scripts. Add a regression test for every bug fix and test both paths of new conditionals.
