# Master Prompt for Codex

You are implementing **UIWitness**, an open-source UI product-state coverage tool.

Read every document in this folder before changing code. Treat `codex/IMPLEMENTATION_SPEC.md` as the detailed specification and `docs/` as supporting product, architecture, quality, security, and launch requirements.

> **UIWitness finds, renders, and reports the UI states your product forgot.**

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
Phase 1 through Phase 7 are complete. The public packages, protected release workflow, launch assets, consumer smoke gates, example evidence, and contributor/release guidance are implemented. The approved Public URL Quick Check roadmap is also complete: bounded discovery, fixed-matrix evidence, kinetic reporting, `uiwitness check <url>` orchestration, overwrite-safe `--write-config` promotion, public launch guidance, and the registry-only check → promotion → scan → open release gate are implemented. Keep future work in an explicitly approved roadmap slice.

The approved [State Contract Guard roadmap](../docs/designs/uiwitness-state-contract-guard.md) is active. T1 through T3 are complete: strict contracts and canonical digests, deterministic comparison and verdict precedence, complete fresh-run `uiwitness guard` orchestration, exact-coordinate reproduction, and deterministic machine verdicts. T4 through T14 remain separate approved slices and must not be pulled forward implicitly.

At each handoff, provide the API added, behavior, fixture coverage, build/test commands, assumptions, unresolved questions, and the recommended next step.
