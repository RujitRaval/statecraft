# ADR 0022: Example Orders States

## Status

Accepted on 2026-08-20.

## Context

Phase 6 needs an order-management surface that demonstrates meaningful product states without coupling fixtures to production-only switches. The route must remain polished enough for report evidence while staying deterministic in local and CI runs.

## Decision

Add a fixed, typed `/api/orders` response contract and a client-rendered `/orders` boundary with explicit success, loading, empty, and recoverable error states. Validate every record and duplicate identifier before rendering. Derive summary values from validated records instead of maintaining a second count contract. Keep search and status filtering local to the rendered queue, reflect those controls in the page URL, and preserve Statecraft scenario interception as the mechanism for forcing API states. Make shared workspace navigation route-aware for both desktop and mobile.

## Consequences

- The orders route behaves like a real fulfillment workspace while remaining fully fictional and network-independent.
- Loading skeletons match the queue structure; empty and error states include clear recovery actions.
- Unit tests protect the runtime contract and derived summaries, while production-browser tests cover all four states, filters, navigation, theme, and responsive overflow.
- No new dependency, backend, database, telemetry, production endpoint, or test-only application flag is introduced.
- Customer detail, intentional defects, and the complete example scenario matrix remain separate Phase 6 changes.
