# ADR 0029: Bounded public URL route discovery

## Status

Accepted

## Context

Statecraft's configured scan is deterministic because developers explicitly define routes and states. The approved public URL Quick Check needs a lower-friction first step: accept one authorized website URL and discover a small route surface without pretending that crawling a changing live site provides full application-state coverage.

Discovery must bound browser work and untrusted page input, preserve privacy, avoid sharing cookies or storage between pages, and honestly handle redirects. Playwright reports the final URL after a server redirect, so a later external redirect can issue one ordinary GET before Statecraft can reject the destination.

## Decision

- Expose `discoverPublicRoutes(url, options?)` from `statecraft-ui-runner-playwright`.
- Validate absolute HTTP(S) input without credentials and bounded positive-integer options before launching Chromium. Remove the supplied query and fragment before the first request.
- Reuse one Chromium process, but create a fresh browser context for every attempted page.
- Let the initial redirect chain establish the canonical origin. Require the starting page to finish as an HTML HTTP(S) document and pass deterministic readiness.
- Discover unique same-origin pathnames sequentially in first-seen breadth-first order. Strip query strings and fragments, ignore download and common non-document links, and inspect at most the first 1,000 rendered anchors per page.
- Default to five attempts and permit at most twenty. Failed and skipped candidates consume the same hard budget as accepted pages.
- Keep a later navigation or readiness failure as the requested path without extracting links. Skip later non-HTML pages and cross-origin redirects; do not extract or follow links from an external destination.
- Return only the canonical base URL, accepted paths, and bounded aggregate counts. Use stable sanitized errors for initial discovery failures.

## Consequences

Callers receive a deterministic route order for the same rendered DOM and a predictable upper bound on page attempts and anchor processing. Page-local cookies and storage do not cross discovery attempts, and user-supplied query values do not enter the first request or returned route contract.

The starting HTML response is accepted even when its HTTP status is an error so later Quick Check execution can report that evidence. Failed later routes remain visible as leaf candidates for the same reason. Non-HTML and cross-origin candidates are excluded.

Discovery still executes each loaded site's JavaScript and ordinary requests. Statecraft does not click, submit forms, retain session state between pages, or promise that navigation is side-effect free. Live personalization, experiments, geography, timing, and content changes can alter observations. A later external redirect may receive one GET before final-origin validation, but its content does not expand the crawl.

This decision covers route discovery only. Quick Check matrix expansion, public-site assertions, screenshots, report persistence, CLI parsing, and overwrite-safe configuration generation remain separate roadmap slices.
