# Open-Source Launch Strategy

## Goal
Earn adoption and stars by solving a recognizable paid-tool-adjacent problem with an excellent local-first experience.

## Positioning
**Find the UI states your product forgot.** Visual regression tells you whether pixels changed; Statecraft tells you whether important product states survive reality.

## Hero asset
The generated report. The example must visibly catch defects such as long content breaking mobile or an API error crashing one state.

The checked-in assets are generated from the real Northline report:

- `docs/assets/statecraft-report-overview.png` shows the kinetic evidence verdict and 60-cell coverage signal.
- `docs/assets/statecraft-failure-detail.png` shows the approved customer long-content mobile overflow with its assertion and execution metadata.

Regenerate them only from the complete local example scan. Start the production example, run its checked-in Statecraft matrix, confirm the expected 56 passes and four failures, then run `corepack pnpm launch:assets`. Review both PNGs for fictional-only data before committing them. The capture command blocks HTTP and HTTPS requests while opening the self-contained file report.

## README above fold
Name; promise; excellent GIF/screenshot; `npx statecraft scan`; tiny matrix; contrast with conventional visual regression.

## Distribution after stability
npm; GitHub Actions workflow; demo repo; posts showing real findings; later Codex/Claude/OpenCode skills.

## Contribution surfaces
Scenarios, examples, report UX, and later adapters/policies. Prepare bounded `good first issue` work.

## Metrics
Stars plus npm downloads, repeat users, issues from real use, contributors, forks, downstream integrations, adapter requests.

## Avoid
No fake activity, AI overclaiming, half-working universal framework, cloud gate, or SaaS before demand.

## Current status

Phase 7 is complete. The public README, real report assets, npm packages, protected release workflow, consumer smoke gates, GitHub Actions guide, and contributor/release guidance are live. Future launch work should distribute these proofs rather than expand the v0.1 product boundary.
