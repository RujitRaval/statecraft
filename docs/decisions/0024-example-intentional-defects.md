# ADR 0024: Example Intentional Defects

## Status

Accepted on 2026-08-20.

## Context

Phase 6 must give Statecraft visually obvious, deterministic problems that a normal happy-path review can miss. The defects need to emerge from realistic content, viewport, and theme combinations without a query flag, production-only test switch, unstable timing, external data, or a separate fixture schema. The complete route/state/viewport/theme scenario matrix remains a separate slice.

## Decision

Preserve two focused visual defects in the example application:

1. At widths up to 680 pixels, customer contact email links do not wrap. The default fictional customer still fits, while the valid long-content customer overflows its contact card and the document viewport.
2. In dark theme, the orders service-error signal uses the same foreground and background color, making its exclamation mark and status caption disappear. The error heading, explanation, and retry control remain usable, and light theme is unaffected.

Keep both behaviors in the production layout rather than adding a Statecraft-only switch. Protect their exact trigger boundaries with real-Chromium tests that assert the known bad computed layout and color values. In the following Phase 6 slice, scenario assertions will express the desired invariants and turn only the affected matrix cells into expected failures.

## Consequences

- The example remains polished in ordinary success states while showing why viewport and theme coverage matters.
- The responsive defect depends on valid long content, and the theme defect depends on a valid recoverable error state; neither relies on nondeterministic loading or network behavior.
- Browser tests prevent accidental removal or widening of either defect before the demo matrix is in place.
- The complete scenario matrix, known-failure assertions, report generation, and example-app end-to-end gate remain out of this slice.
