# ADR 0037: Make Exception Renewal Explicit and Exact

## Status

Accepted.

## Context

Known failures let teams adopt State Contract Guard before every existing defect is repaired, but the debt must remain exact, owned, visible, and temporary. An expired exception can coincide with three materially different observations: the same exact failure set still exists, the failure codes changed, or the coordinate recovered. Treating all three as a renewable exception would let stale intent mask a different product state or recreate debt that no longer exists.

## Decision

Derive exception lifecycle from the verdict's single injected UTC calendar date. The exception remains active through its `expiresOn` day and is expired on the next UTC day. Surface its owner, reason, dates, exact expected and actual codes, and lifecycle consistently in terminal output, machine JSON, offline HTML, and bounded GitHub summaries and annotations. Reject control and default-ignorable Unicode characters from new ownership metadata. Preserve schema-v1 contract compatibility, but render any legacy control or invisible character as an explicit code-point escape at terminal, HTML, and GitHub presentation boundaries so it cannot spoof visible intent.

Generate an `exception:<coordinate>` proposal operation only when an expired exception's exact eligible failure-code set is still observed. Renewal requires a newly annotated current 1–30 day window and a reason whose trimmed visible value differs from the prior exception. Changed failure codes and recovered coordinates generate `expectation:<coordinate>` operations instead: changed eligible codes require a new explicit expectation and exception decision, ineligible codes are refused before annotation and must be repaired, while recovery removes the failed expectation's exception. Dates are never extended automatically.

## Consequences

- Expiry cannot silently prolong known-failure debt.
- Added, removed, or substituted codes cannot inherit stale exception approval.
- Recovery has a direct contract-debt removal path rather than a renewal path.
- Local and GitHub presentation can explain one lifecycle from deterministic verdict data without reading wall-clock time independently.
- Renewing the same underlying defect remains possible, but it creates an auditable new ownership decision.
