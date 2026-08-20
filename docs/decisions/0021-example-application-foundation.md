# ADR 0021: Example Application Foundation

## Status

Accepted on 2026-08-20.

## Context

Phase 6 needs a launch-quality product surface that also behaves like a realistic deterministic Statecraft fixture. Building every route and defect in one slice would make visual, data, and scenario failures difficult to isolate.

## Decision

Start with a focused Next.js App Router foundation and one complete `/dashboard` surface. Keep the example's data in a typed fixed fixture exposed through `/api/dashboard`; the client validates responses and renders explicit loading, success, empty, and recoverable error states. Future Statecraft scenarios will create those conditions through Playwright route interception rather than test-only query flags or production mocks. Use one self-hosted variable font and a documented industrial-editorial visual system so local and CI builds need no font network access. Run every Next.js command through a repository-owned wrapper that disables framework telemetry before the CLI loads.

## Consequences

- The first slice proves the visual and state architecture before multiplying routes.
- A shared server-rendered workspace layout keeps navigation chrome reusable while each route hydrates only its interactive state surface.
- Browser scenarios can exercise real request behavior without changing application code.
- `/orders`, `/customers/[id]`, intentional defects, and the full scan matrix remain separate Phase 6 changes.
- The example adds Next.js, React, React DOM, React types, and one self-hosted font package to the workspace; no application backend, database, telemetry, or external service is introduced.
