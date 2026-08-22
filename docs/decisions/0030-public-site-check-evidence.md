# ADR 0030: Public-site check matrix and evidence

- Status: Accepted
- Date: 2026-08-22

## Context

Bounded public-route discovery now returns a small authorized surface, but discovery alone does not produce the evidence that makes Quick Check useful. The runner needs an exact matrix, high-confidence assertions, warning-only browser diagnostics, screenshots, and a validated offline report without writing or importing temporary executable scenario files.

## Decision

- Expose `runPublicSiteChecks(discovery, options?)` as the narrow runner-owned orchestration boundary.
- Expand every accepted route in discovery order into one `public` state and exactly four cells: mobile `390x844` light, mobile dark, desktop `1440x900` light, then desktop dark.
- Derive route IDs from a bounded readable pathname slug plus the first 12 hexadecimal characters of a SHA-256 pathname digest. Similar readable paths such as `/a-b` and `/a/b` therefore remain distinct.
- Use the explicit validated programmatic scenario override shared by navigated, captured, and persisted runner calls. Keep configured scenario-path loading pure; do not write or dynamically import a temporary scenario module.
- Fail cells for main-document navigation failure, HTTP status 400 or higher, uncaught page errors, and horizontal document overflow greater than one CSS pixel.
- Preserve console errors and subordinate request failures as sanitized, bounded diagnostics without failing the cell.
- Capture the viewport PNG before assertions and publish every available screenshot, including evidence for HTTP, page-error, and overflow failures.
- Keep a main-frame document-navigation guard active from readiness through screenshot and assertion completion. If any replacement document starts, discard the PNG and report a navigation failure.
- Reuse the existing private `.statecraft/` transaction, schema-v1 report, collision-resistant artifact paths, and self-contained offline HTML renderer.
- Export `publicSiteScenario` so the later overwrite-safe generated scenario can delegate to the same evolving assertion contract.

## Consequences

The same accepted route always expands into the same four ordered execution coordinates and artifact paths. Quick Check produces actionable evidence without claiming loading, empty, error, authenticated, or application-specific state coverage. A page that cannot navigate or cannot capture a screenshot may still have no image; the report retains all evidence available before that failure.

The one-pixel overflow tolerance avoids treating a rounding-sized delta as a defect. This is intentionally narrower than element clipping, accessibility, or content-quality heuristics, which remain deferred until their false-positive rate is proven acceptable.

The runner does not upload results and does not read request/response headers, bodies, cookies, or console argument handles. Loading a page still runs that site's JavaScript and ordinary requests, so callers must check only websites they own or are authorized to test.

## Scope

This decision implements runner execution and evidence only. CLI `statecraft check` orchestration, terminal summaries, exit codes, and overwrite-safe permanent configuration generation remain separate follow-up slices. Report visual redesign is also separate from this runner branch.
