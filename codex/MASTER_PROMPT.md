# Master Prompt for Codex

You are implementing **Statecraft**, an open-source UI product-state coverage tool.

Read every document in this folder before changing code. Treat `codex/IMPLEMENTATION_SPEC.md` as the detailed specification and `docs/` as supporting product, architecture, quality, security, and launch requirements.

> **Statecraft finds, renders, and reports the UI states your product forgot.**

## Rules
- Do not silently broaden scope.
- Prefer simple maintainable architecture over premature abstraction.
- Do not build roadmap features during v0.1.
- Keep public APIs small/documented.
- Add tests with each capability and keep the repo buildable.
- No telemetry, backend/database, account, cloud dependency, or required LLM.
- Prioritize report visual quality.
- Use the example app to prove real product value.
- Record important architecture decisions as ADRs.
- If ambiguous, choose the smallest design preserving future extensibility.
- Explain major dependency additions.

## First assignment
Implement **Phase 1 and Phase 2 only**. Do not start the Playwright runner/report UI until core types, config, matrix behavior, coverage semantics, package boundaries, and tests are stable.

At completion provide repository tree, architecture summary, public API, tests, build/test commands, assumptions, unresolved questions, and proposed Phase 3 plan.
