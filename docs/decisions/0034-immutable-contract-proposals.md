# ADR 0034: Immutable contract proposals with separate acceptance metadata

## Status

Accepted

## Context

A failed complete guard run can identify contract drift, but execution outcome alone does not establish human intent. Editing a generated candidate in place, accepting an unnamed aggregate diff, or retaining a partially accepted candidate could silently approve stale or unrelated changes. Exception ownership and expiry must remain reviewable without changing the identity of the generated proposal.

## Decision

- Persist one canonical, content-addressed source snapshot and proposal for a complete generation. Bind the proposal to source-generation, source-contract, expanded-config, and semantic-run digests plus tool/schema versions.
- Derive only stable named `add`, `remove`, `config`, `expectation`, and `exception` operations. Acceptance requires one or more exact change IDs and never infers intent from pass/fail state.
- Keep owner, reason, creation date, and expiry in a separate canonical metadata overlay bound to the proposal digest. Only operations that create or renew a failed expectation accept metadata; exception lifetimes remain 1–30 days and are revalidated on acceptance.
- Make browser-independent parsing, serialization, digesting, regeneration, and selected-change application public from `uiwitness-core`. Keep filesystem and browser orchestration process-only in the CLI.
- Under one contract-writer lock, reread the source/proposal/overlay, verify content-addressed filenames and canonical bytes, regenerate every operation, and revalidate the current contract and expanded config immediately before publication.
- Apply only selected changes. On success, consume the proposal and overlay and report unselected IDs as discarded; reconsideration requires a new complete guard run. Initial contract creation remains exclusive and no-clobber.
- Allow an identical repeated guard to reuse byte-identical immutable artifacts while preserving a valid existing overlay. Reject collisions, mutations, symbolic/hard links, stale inputs, unknown metadata, and concurrent writers.

## Consequences

Review intent is explicit, auditable, and bound to one fresh complete run. Metadata can evolve during review without invalidating proposal identity, while partial acceptance cannot leave a reusable residual candidate. The CLI adds small local source/proposal files that may reveal route and state inventories and therefore remain inside the ignored private `.uiwitness/` tree. T4 does not make runner evidence, verdict, proposal, overlay, and contract publication one crash-atomic transaction; the approved T5 generation-transaction slice owns that remaining boundary.
