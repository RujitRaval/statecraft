# Security and Privacy

Statecraft may capture sensitive application screens.

- No telemetry in v0.1.
- No automatic upload of screenshots, reports, URLs, diagnostics, or source data.
- No external assets in generated reports.
- Do not persist authorization headers, cookies, tokens, or sensitive request bodies by default.
- Sanitize request diagnostics.
- Config/scenario modules are trusted local code running with user privileges; document this.
- Recommend ignoring `.statecraft/` where reports may contain sensitive data.
- Prefer mature dependencies and minimize runtime dependency count.
