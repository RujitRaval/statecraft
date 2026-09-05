# ADR 0038: Memory-only shared-read-only authentication

## Status

Accepted on 2026-09-05.

## Context

Important product states often require login, but a saved Playwright storage-state file contains impersonation-capable cookies and local storage. Repeating login for every matrix cell is slow and encourages ad hoc credential handling. Reusing one browser context would weaken UIWitness's per-cell isolation.

## Decision

An optional trusted local authentication module runs once in a dedicated runner-owned context. It reads credentials directly from user-controlled environment or secret-manager inputs and returns no value. After successful setup, UIWitness calls Playwright `storageState()` without a path, validates the result, and deep-copies it into each otherwise-fresh cell context.

The only mode is `shared-readonly`. Local storage is limited to the application origin and explicit additional origins. An exact host-only application cookie is implicit; parent, sibling, leading-dot, additional-origin, or partitioned cookies require an exact declared domain/path/secure/partition scope. ICANN and private public suffixes are rejected using the pinned MIT-licensed `tldts` Public Suffix List implementation. Authentication paths must stay inside the invocation workspace through regular, non-linked boundaries.

UIWitness-owned errors expose only a stable authentication code and the non-secret setup-module path. Cookies, local storage, environment values, setup return values, headers, and raw thrown values never enter reports, verdicts, logs, or generated files. UIWitness drops its state references after the run but does not claim JavaScript heap erasure or sandbox trusted setup code.

Authenticated configuration uses coordinate fingerprint version 2. The canonical projection includes mode, workspace-relative setup path, normalized origins and cookie scopes, and the default future evidence-policy values; it never includes credentials or storage state. Adding authentication therefore creates explicit reviewable config drift instead of silently reusing an unauthenticated contract.

## Consequences

- Login runs once while every product-state cell retains a fresh context and page.
- Saved auth-state files, credential acquisition, multiple roles, and per-cell login are unsupported.
- Teams must use a non-mutating account appropriate for shared read-only tests; UIWitness cannot enforce server-side behavior in trusted hooks.
- Fork pull requests remain secret-free. Authenticated CI must run only for an exact reviewed commit on a protected trusted branch/environment.
- Authenticated sharding remains prohibited when the shard protocol is introduced; multiple accounts require a separate security design.
