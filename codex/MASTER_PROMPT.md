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

## Current assignment
Phase 1, Phase 2, and Phase 3 are complete. Phase 4 is active. The CLI package now provides deterministic config discovery/loading, overwrite-safe `init`, and `scan` orchestration with exact route filtering, headed mode, private runner persistence, terminal summaries, and exit codes. Continue Phase 4 through a focused `open` slice, and do not start the report UI or another later phase until the user explicitly advances the phase.

At each handoff, provide the API added, behavior, fixture coverage, build/test commands, assumptions, unresolved questions, and the recommended next step inside Phase 4.
