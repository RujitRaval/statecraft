# Security and Privacy

Statecraft may capture sensitive application screens.

- No telemetry in v0.1.
- No automatic upload of screenshots, reports, URLs, diagnostics, or source data.
- No external assets in generated reports.
- Do not persist authorization headers, cookies, tokens, or sensitive request bodies by default.
- Sanitize request diagnostics.
- Capture only failed-request URL, method, and error text; never inspect or retain request headers, response headers, cookies, or bodies. Remove URL credentials and fragments, replace every query value with `[REDACTED]`, redact authorization/cookie values and common token/secret assignments in free-form console and page-error text, pre-bound every value before sanitizing, and cap both diagnostic sizes and counts. Never attach an original unsanitized throwable as a public error cause.
- Config/scenario modules are trusted local code running with user privileges; document this.
- Recommend ignoring `.statecraft/` where reports may contain sensitive data.
- Prefer mature dependencies and minimize runtime dependency count.
