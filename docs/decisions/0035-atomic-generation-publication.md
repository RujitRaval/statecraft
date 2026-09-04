# ADR 0035: One committed generation for report and guard output

## Status

Accepted

## Context

The persisted runner originally replaced screenshots, report JSON, and offline HTML together, while State Contract Guard wrote its verdict, proposal source, immutable proposal, metadata overlay, and optional JSON copy afterward. A crash between those operations could leave individually valid files from different runs, and an orphan proposal could appear acceptable without proof that its source report committed.

## Decision

- Define browser-independent schema-v1 generation manifests and committed-generation markers in `uiwitness-core`. Each manifest records canonical paths, roles, byte lengths, SHA-256 digests, mutability, report/run identities, source-generation identities, completeness, and tool version.
- Let the Playwright runner accept one typed generation finalizer after it has validated the complete in-memory report but before publication. The CLI uses that boundary to produce guard verdicts and proposal families without moving contract comparison or filesystem policy into the runner.
- Stage screenshots, report JSON, report HTML, verdict, proposal source, proposal, metadata overlay, optional JSON copy, manifest, and marker under the existing run lock. Validate canonical verdict/copy bytes and the proposal/source/metadata schemas, content-addressed paths, roles, and cross-file digests before publication. Preflight every destination, fsync staged files and directory entries, and reject symbolic links, hard links, reserved control paths, paths longer than 1,024 characters, conflicting paths, or changed immutable content. Publish exclusive and newly created immutable members with an atomic no-clobber link instead of a check-then-replace rename.
- Swap all generation members with rollback bookkeeping. Publish HTML last among report content and the stable generation marker last overall. During rollback, hide the marker first and restore it only after the previous report and sidecars are coherent again.
- Write a bounded durable journal before destructive renames. The journal authenticates the exact expected marker digest. A later writer may claim an abandoned publishing lock and reconstruct state from the journal plus staging tree: absence of the stable marker swap rolls back, while an exact canonical marker plus its digest-bound manifest proves the commit point and keeps the new generation. A committed lock marker makes cleanup-only interruption explicit. Missing, malformed, unexpected, ambiguous, or incompletely recoverable state remains preserved and fail-closed.
- Use one lock order for contract-aware mutations: the CLI holds `contract.lock` from the guard contract snapshot through runner publication, while acceptance takes `contract.lock` and then the runner generation lock through marker revalidation, contract commit, and proposal consumption. Require acceptance to resolve its proposal source digest through the current committed marker and require both proposal and source paths with their exact manifest roles. Valid standalone proposal bytes are insufficient.

## Consequences

One completed guard or failed initialization now produces a coherent local generation, and failures cannot leave an acceptable orphan proposal or mismatched verdict/report set. Ordinary scans also receive a committed manifest and marker. The additional canonical files and fsyncs add small local I/O and keep historical content-addressed manifests; UIWitness still performs no upload, telemetry, account, or hosted coordination. Metadata remains intentionally mutable after publication, so its manifest entry records the bytes at generation time while acceptance separately validates the current constrained overlay.
