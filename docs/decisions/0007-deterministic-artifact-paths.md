# ADR 0007: Deterministic screenshot artifact paths

## Status

Accepted

## Context

Every matrix cell needs one stable screenshot location that later runner and report packages can share. A naive `<viewport>-<theme>.png` filename collides when identifiers contain hyphens: `desktop` + `wide-dark` and `desktop-wide` + `dark` both become `desktop-wide-dark.png`. Paths must also remain safe if a caller constructs a `MatrixCell` without first using runtime config validation.

## Decision

- Add `screenshotArtifactPath(cell)` to `@statecraft/core`. It returns a project-relative POSIX-style PNG path and performs no filesystem access.
- Return an opaque `ScreenshotArtifactPath` type so ordinary strings, including traversal-shaped literals, cannot be treated as safely encoded paths without an explicit unsafe assertion.
- Keep the public layout `.statecraft/artifacts/<route>/<state>/<viewport>-<theme>.png` and preserve readable validated route and state directory names.
- Encode hyphens inside the two filename identifiers, plus every character outside lowercase ASCII letters and digits, as a fixed-width Unicode code point prefixed with `~`. Encode unsafe characters and Windows-reserved basenames in route and state identifiers as well.
- Reserve a single `~` for an empty segment. Because a literal `~` is encoded, the mapping remains one-to-one even for forged inputs.
- Bound each encoded identifier to 120 ASCII characters. Longer values keep a 54-character readable prefix, the reserved `~~` marker, and a full SHA-256 hex digest of the unbounded encoding. This keeps each directory component below common 255-byte limits and keeps the combined viewport/theme PNG filename at or below 245 bytes.
- Keep metadata in result contracts rather than parsing it back from filenames.

## Consequences

Normal identifiers retain familiar paths such as `desktop-light.png`; compound identifiers remain unambiguous. The ASCII-only encoding is stable across operating systems, path separators, component-length limits, reserved device names, case-folding behavior, and Unicode normalization. Long inputs are collision-resistant rather than reversible because they use a SHA-256 suffix. The future runner owns directory creation and PNG writes, while the report consumes explicit metadata and the returned path.
