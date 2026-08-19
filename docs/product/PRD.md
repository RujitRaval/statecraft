# Product Requirements Document

## Vision
Statecraft should define **UI product-state coverage**. Visual regression asks whether pixels changed; Statecraft asks whether important states exist and work across realistic conditions.

## Problem
Production UIs routinely fail outside happy-path seed data: loading, empty, API failure, offline, unauthorized, long content, partial data, responsive layouts, and themes. These states are difficult to inspect systematically and are often skipped by humans and coding agents.

## Users
Primary: frontend/full-stack engineers, solo and AI-assisted developers, open-source maintainers. Secondary: QA, product designers, design-system teams, engineering managers.

## Core job
Given explicit routes and scenarios, render the configured matrix of route x state x viewport x theme, capture evidence and diagnostics, and generate a polished local report.

## MVP
Local TypeScript/Node CLI; Playwright; type-safe config/scenarios; arbitrary named states; viewports/themes; isolated contexts; PNG screenshots; console/page/request diagnostics; assertions; configured-state coverage; offline HTML + versioned JSON; init/scan/open; stable exit codes; Next.js example; GitHub Actions documentation.

## Non-goals v0.1
No SaaS, accounts, cloud storage, billing, LLM requirement, automatic route/state discovery, pixel diffing, approval workflow, or broad framework support.

## Success
A new developer can install, configure a few states, run one command, and understand a visually obvious UI problem from the report without author assistance. The report is strong enough to be the primary README/launch asset.

## Principles
Local-first; deterministic; explicit before magical; progressive adoption; small API; Playwright escape hatches; extensible architecture; excellent defaults.

## Recommended vocabulary
`success`, `loading`, `empty`, `error`, `offline`, `unauthorized`, `forbidden`, `not-found`, `partial`, `stale`, `long-content`, `large-data`, `slow-network`. Domain-specific IDs remain valid.
