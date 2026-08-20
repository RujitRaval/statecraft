# Security and Privacy

Statecraft may capture sensitive application screens.

- No telemetry in v0.1.
- No automatic upload of screenshots, reports, URLs, diagnostics, or source data.
- No external assets in generated reports.
- Do not persist authorization headers, cookies, tokens, or sensitive request bodies by default.
- Sanitize request diagnostics.
- Capture only failed-request URL, method, and error text; never inspect or retain request headers, response headers, cookies, or bodies. Remove URL credentials and fragments, replace every query value with `[REDACTED]`, redact authorization/cookie values and common token/secret assignments in free-form console and page-error text, pre-bound every value before sanitizing, and cap both diagnostic sizes and counts. Never attach an original unsanitized throwable as a public error cause.
- Config/scenario modules are trusted local code running with user privileges; importing a config can execute arbitrary local code. Default config lookup checks names only inside the selected project directory, returns canonical paths (including symbolic-link targets), and refuses ambiguous files instead of silently executing one. An explicit config path may point elsewhere.
- `statecraft init` never offers a force mode. It rejects existing generated targets and symbolic-link directory boundaries, creates files exclusively, publishes the config last, and never deletes paths during failure recovery because a concurrently changed path may no longer be owned by that invocation.
- `statecraft scan` executes trusted config and scenario modules locally, writes only runner-owned PNG and schema-v1 JSON output beneath the invocation directory's `.statecraft/`, and prints report metadata rather than diagnostic payloads. Exact route validation completes before output creation.
- `statecraft open` validates the fixed `.statecraft/report/index.html` target beneath the canonical invocation directory, rejects symbolic-link or non-regular path boundaries observed during validation, and passes the absolute path as one shell-free argument to an absolute system-launcher path so repository-local binaries cannot intercept the handoff. The operating-system handoff is pathname-based and cannot atomically pin the validated file, so the local project/report directory is trusted against concurrent same-user mutation during that handoff. The command does not generate, rewrite, upload, or parse report contents.
- Recommend ignoring `.statecraft/` where reports may contain sensitive data.
- Persist screenshots and JSON with owner-only modes for new and existing runner directories/files where supported. Reject symbolic-link artifact/report targets, stage runner-owned output inside `.statecraft/`, and serialize complete runs with a process-owned, phase-aware local lock that only auto-recovers abandoned capture-only state. Publish JSON only after its artifact tree, and preserve publishing/recovery data rather than deleting the last good copies when rollback is incomplete. Replace only runner-owned artifacts plus `statecraft.json` so future offline UI files remain intact.
- Prefer mature dependencies and minimize runtime dependency count.
