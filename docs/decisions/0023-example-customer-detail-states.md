# ADR 0023: Example Customer-Detail States

## Status

Accepted on 2026-08-20.

## Context

Phase 6 needs a customer-detail surface that demonstrates nested operational data, authorization boundaries, transport failure, loading behavior, and unusually long content. These states must remain deterministic and interceptable without adding production-only test flags or separate schemas for visual fixtures.

## Decision

Add a dynamic `/api/customers/[id]` response contract and a client-rendered `/customers/[id]` boundary with explicit success, loading, 401/403 authorization, 404 not-found, and recoverable service-error states. Keep fixtures in a `server-only` module and expose only types, parsing, and formatting to the client bundle. Validate nested contact, metric, order, activity, delivery, and note data at runtime, including safe integer and cross-record relationships, unique nested identifiers, and route-to-response identity. Use one fictional default customer in the production route, return 404 for unknown identifiers, and let Statecraft scenarios intercept the API for authorization, service-failure, and alternate long-content responses. Treat long content as valid data through the same contract and layout. Extend the shared route-aware workspace navigation to the canonical customer record.

## Consequences

- The example demonstrates a realistic account dossier without a backend, database, network dependency, telemetry, or test-only application switch.
- Authorization failures disclose no customer fields in either the rendered page or browser chunks, while not-found and service failures remain distinguishable.
- Long names, roles, contact details, addresses, notes, and activity descriptions exercise the production layout and dark theme without horizontal overflow; review-status accounts use the warning signal rather than the healthy signal.
- Recent customer history remains visible, while only orders present in the live queue link to `/orders`; linked order status and amount values match the canonical queue fixture.
- Unit tests protect nested validation, relational invariants, and cent precision; production-browser tests cover the requested states, 401/403/404 distinctions, route identity, client-bundle privacy, links, retry behavior, theme, accessibility semantics, and responsive layout.
- Intentional defects and the complete example scenario matrix remain separate Phase 6 changes.
