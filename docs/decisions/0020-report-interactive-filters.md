# ADR 0020: Self-contained offline report interaction

## Status

Accepted

## Context

The final Phase 5 slice must make large reports searchable by route, state, viewport, theme, and status while improving evidence inspection and keyboard use. The report must remain one deterministic offline document with no server, external asset, telemetry, or client framework. Report-controlled strings and diagnostics cannot cross an executable-code boundary.

## Decision

- Derive native select options only from validated execution metadata in deterministic first-seen order. Combine active route, state, viewport, theme, and status selections with AND semantics.
- Store valid non-default selections in the local document query string and ignore unknown values when restoring a report. Keep summary metrics unchanged while an `aria-live` line reports the filtered execution and row counts.
- Filter matrix headers, slots, rows, and route row-group headings in place so viewport/theme columns stay aligned and the first visible route heading receives the correct row span. Show a direct no-match message and one reset action.
- Keep report values in escaped HTML attributes and text. Embed one constant interaction script that queries those attributes; compute its SHA-256 during rendering and authorize only that exact hash in Content Security Policy. Load no external script, stylesheet, image, font, or network resource.
- Preserve progressive fallback behavior: without script, cell anchors and every execution detail remain present and usable. With script, expose one active inline detail inspector, focus it after selection, mark the source cell, support Escape and Close with focus return, synchronize hashes/history, and use native disclosure elements for counted diagnostics.
- Add no client framework or third-party runtime dependency. Use the Node.js cryptography built-in only to calculate the CSP hash for the emitted script.

## Consequences

Developers can narrow dense local reports without losing matrix context, share or reload a filtered local URL, and inspect one execution without scrolling through every detail. The renderer remains deterministic and keeps untrusted report data out of executable code. The generated document now contains narrowly scoped JavaScript, but CSP rejects any script whose bytes do not exactly match the renderer-owned interaction program. Phase 5's offline, responsive, keyboard, and launch-visual gate is complete without starting the example application.
