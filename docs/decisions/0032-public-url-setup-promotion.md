# ADR 0032: Overwrite-safe public URL setup promotion

- Status: Accepted
- Date: 2026-08-22

## Context

Quick Check can discover an authorized public surface and persist useful evidence without configuration. Requiring users to retype those accepted routes into a permanent project wastes the discovery work, but generating trusted executable files introduces overwrite, symbolic-link, partial-write, and assertion-drift risks.

## Decision

- Add explicit `statecraft check <url> --write-config` and `writeConfig: true`. The unflagged command continues to write only ignored `.statecraft/` evidence and prints the exact promotion command.
- Preflight every supported default config name, `statecraft/scenarios/public/default.mts`, and each directory boundary before importing or launching the browser runner. Name every conflict and never offer force or merge behavior.
- Extract one internal publication primitive shared with `statecraft init`. It canonicalizes the project root, rejects observed symbolic-link or non-directory boundaries, creates files exclusively, writes the scenario first, and publishes `statecraft.config.mts` last.
- Publish only after discovery and the coordinated evidence run complete, even when completed cells contain product failures. Never delete files during recovery; a concurrent process may have replaced a path after creation.
- Generate the canonical base URL, accepted routes in discovery order, their runner-owned collision-resistant route IDs, one shared `public` state, the fixed mobile/desktop and light/dark matrix, and the same diagnostic failure policy as Quick Check. Serialize those fixed fields from one lightweight runner-owned contract so Quick Check and promoted scans cannot drift.
- Generate a module-unambiguous `.mts` scenario importing `publicSiteScenario` from the narrow `statecraft-ui/public-site-scenario` package subpath. Keep the main CLI import lightweight and avoid exposing Playwright types through this helper contract.
- Return immutable generated paths through `CheckResult.setup`. Classify conflicts and write failures with stable `CHECK_SETUP_*` errors and preserve terminal sanitization.

## Consequences

A useful zero-config run can become a reviewable configured Statecraft project without re-entering routes. The untouched generated setup compiles and reproduces the same route × viewport × theme matrix through `statecraft scan`, while future edits can add application-specific states that public discovery cannot infer.

The operation is intentionally additive rather than a config merger. Existing projects must edit their config deliberately. A late filesystem race can leave newly generated files for inspection, but it never overwrites or deletes an existing path and never reports a partially published setup as success.
