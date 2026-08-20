# ADR 0012: Runner navigation, themes, and deterministic readiness

## Status

Accepted

## Context

Phase 3 needs one built-in path from a configured matrix cell to a stable page that later screenshot and diagnostic work can consume. Navigation must preserve scenario hook order, arbitrary named themes must remain useful, and readiness cannot depend on `networkidle` because modern applications may keep persistent connections open.

## Decision

- Add `runNavigatedScenarioCells` with a required HTTP(S) base URL and a post-readiness callback.
- Resolve slash-prefixed route paths against the base URL and reject paths that change origin, even when callers bypass core runtime validation. Recheck the page origin after built-in navigation and `afterNavigate` so redirects or hook-driven navigation cannot escape the boundary before readiness and caller-owned work.
- Apply `data-theme` before application scripts. Map `light` and `dark` to color-scheme media emulation, map other themes to `no-preference`, and request reduced motion for every theme.
- Preserve the lifecycle order: theme setup, `beforeNavigate`, DOM-content-loaded navigation, `afterNavigate`, deterministic readiness, then caller-owned post-readiness work.
- Define readiness as bounded normal-load, optional visible-selector, and font-set gates after injecting stability styles that suppress animation, transitions, smooth scrolling, and carets. Never use `networkidle` or an implicit fixed delay.
- Return frozen requested/final URL metadata and the built-in requested navigation's response status to the post-readiness callback. Recheck the origin after readiness so scheduled navigation cannot escape the boundary before caller-owned work. Treat scenario, hook, navigation, readiness, and callback failures as cell failures so later cells continue.

## Consequences

The next Phase 3 slice can capture screenshots and diagnostics from a deterministic post-readiness seam without changing hook order or reopening navigation policy. Applications using standard light/dark media queries or `data-theme` work without a custom adapter; other mechanisms remain possible through direct Playwright access in scenario hooks. Timeouts are explicit and bounded, while scenario-controlled waits remain available through `afterNavigate`.
