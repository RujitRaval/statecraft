# Releasing UIWitness

UIWitness publishes four npm packages from one verified GitHub Release:

| Package | Purpose |
| --- | --- |
| `uiwitness-core` | Browser-independent configuration, state-contract, canonical-digest, matrix, coverage, and report contracts |
| `uiwitness-report` | Deterministic offline report transformation and rendering |
| `uiwitness-runner-playwright` | Playwright execution and local result persistence |
| `uiwitness` | Public API and the `uiwitness` executable |

All four packages are public, the repository is `RujitRaval/uiwitness`, and npm trusted publishing is configured for the protected release workflow. Local package smoke remains a pre-publication gate; the live registry and protected release runs are the distribution proof.

## Version contract

`VERSION` is the source of truth. A repository version such as `0.24.0.0` publishes npm version `0.24.0` and Git tag `v0.24.0`. The fourth component must be zero; release validation rejects a nonzero value because npm cannot represent it without colliding with the same three-component version.

After changing `VERSION`, synchronize and validate every manifest:

```bash
corepack pnpm release:sync-version
corepack pnpm release:check
```

Do not edit public package versions independently.

## Local release verification

Use a locked dependency installation and the pinned Chromium build, then run both consumer gates:

```bash
corepack pnpm install --frozen-lockfile
corepack pnpm --filter uiwitness-runner-playwright exec playwright install chromium
node scripts/run-ci.mjs
corepack pnpm release:package-smoke
corepack pnpm release:smoke
```

`release:package-smoke` builds and packs each public workspace, asks npm to validate a dry-run publication, creates a CommonJS-default consumer with `npm init -y`, installs the exact tarballs, imports all public APIs, installs Chromium, and runs the generated `.mts` starter through a complete four-cell scan. Temporary tarballs, screenshots, and reports stay inside removed temporary directories; `*.tgz` and `.uiwitness/` remain ignored.

After npm publication, repeat the exact live-registry Quick Check journey for the released version:

```bash
corepack pnpm release:registry-public-url-smoke -- --version 0.24.11
```

This creates another empty `npm init -y` consumer, accepts either an implicit CommonJS manifest or npm 11's explicit `"type": "commonjs"` form, installs exact packages from the explicit npmjs registry, and runs evidence-only `check` → `check --write-config` → untouched `scan` → `open` against a deterministic two-page loopback fixture. It validates eight screenshots, schema-v1 JSON, kinetic HTML, generated-source stability, and the installed report-opening command before removing the temporary project. Use the npm version that was just published; this gate cannot pass before that version exists on the registry. Transient install failures share one bounded ten-minute elapsed-time retry window. Each attempt forces online registry revalidation through its own temporary npm cache, while permanent failures stop immediately.

## First publication bootstrap (completed 2026-09-01)

npm requires each package to exist before a trusted publisher can be configured. For the first release only:

1. Create a GitHub Environment named `npm-publish`, require a maintainer's approval, and restrict deployment to protected release tags.
2. Create a granular npm access token with `All Packages` read/write permission, bypass-2FA enabled, and the shortest available expiry. npm cannot grant an unclaimed package-specific permission, so this bootstrap credential is temporarily broader than the steady-state publisher.
3. Store the token only as the `NPM_TOKEN` secret in the protected `npm-publish` Environment.
4. Merge a fully green release pull request and create a non-prerelease GitHub Release whose tag exactly matches `VERSION`, for example `v0.24.0`.
5. Approve the protected Environment deployment and wait for the `Release` workflow to verify and publish all four packages. Bootstrap mode deliberately does not start registry verification automatically.
6. If publication is partial, complete cleanup before retrying. Record the attempt ID, package outcomes, finish time, token fingerprint, token-revocation time, GitHub-secret-deletion time, and cleanup-completion time. Create a fresh minimum-expiration token for the next attempt. The publisher rechecks every tarball and skips only an existing version with identical registry integrity; it stops on mismatched immutable contents.
7. In npm package settings for each package, add the GitHub Actions trusted publisher for repository `RujitRaval/uiwitness`, workflow `.github/workflows/release.yml`, and environment `npm-publish`.
8. Within 30 minutes of every successful or failed attempt, revoke that attempt's token, delete the `NPM_TOKEN` Environment secret, and finish its cleanup record.
9. After all four packages exist and all attempt records are complete, manually run `Verify Registry Release`. Supply the immutable release tag and one compact schema-v1 cleanup-evidence JSON object. The workflow resolves the tag commit, proves it belongs to `main`, checks `VERSION` and the GitHub Release, validates fresh-token and 30-minute cleanup evidence for every attempt, then runs the registry-only journey from that exact tag.

The cleanup evidence has this shape. Package entries remain in dependency-first order, and the final recorded outcome for every package must be `published` or `verified-existing`:

```json
{
  "schemaVersion": 1,
  "releaseTag": "v0.25.3",
  "releaseSha": "0123456789abcdef0123456789abcdef01234567",
  "attempts": [{
    "id": "123456789-1",
    "tokenFingerprint": "sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    "finishedAt": "2026-08-31T20:00:00.000Z",
    "tokenRevokedAt": "2026-08-31T20:05:00.000Z",
    "githubSecretDeletedAt": "2026-08-31T20:06:00.000Z",
    "cleanupCompletedAt": "2026-08-31T20:07:00.000Z",
    "packages": [
      { "name": "uiwitness-core", "outcome": "published" },
      { "name": "uiwitness-report", "outcome": "published" },
      { "name": "uiwitness-runner-playwright", "outcome": "published" },
      { "name": "uiwitness", "outcome": "published" }
    ]
  }],
  "trustedPublishers": [
    { "name": "uiwitness-core", "configuredAt": "2026-08-31T20:04:00.000Z" },
    { "name": "uiwitness-report", "configuredAt": "2026-08-31T20:04:00.000Z" },
    { "name": "uiwitness-runner-playwright", "configuredAt": "2026-08-31T20:04:00.000Z" },
    { "name": "uiwitness", "configuredAt": "2026-08-31T20:04:00.000Z" }
  ]
}
```

The UIWitness bootstrap completed once at `v0.25.4` from commit `3fb14801174b9266da9ce018f088b04f60b6b152`. Release run `33503369173` published all four packages dependency-first. The protected `NPM_TOKEN` secret was deleted at `2026-09-01T11:50:54Z`; the bootstrap token was revoked and cleanup completed at `2026-09-01T11:58:11Z`, 17 minutes 5 seconds after workflow completion. Registry-only verification run `33505311010` then passed from immutable tag `v0.25.4`. Cleanup evidence remains outside source control. Do not repeat the bootstrap path for normal releases.

The workflow configures token authentication only when that bootstrap secret exists. After bootstrap, GitHub's short-lived OIDC identity supplies publication authority through the workflow's `id-token: write` permission, with no token-style npm configuration present to suppress the OIDC exchange. No npm token should remain configured. The Environment approval remains a deliberate human gate for every registry publication. Normal OIDC releases automatically start the final tag/SHA-bound registry job; only bootstrap mode uses the cleanup-gated manual workflow.

## Normal releases after bootstrap

1. Start a focused branch from current `main`.
2. Run GStack `review`, then GStack `ship`; ensure the selected four-component version has a zero fourth component and manifests are synchronized.
3. Merge the fully green pull request through GitHub.
4. Create a non-prerelease `vMAJOR.MINOR.PATCH` GitHub Release from the merged commit on `main`.
5. Approve the `npm-publish` Environment deployment.
6. Confirm the `Release` workflow is green and verify all four package versions on npm. Its final release job runs the exact registry-only public URL consumer journey after publication with an independent 25-minute budget.

The first normal OIDC release completed at [`v0.25.5`](https://github.com/RujitRaval/uiwitness/releases/tag/v0.25.5) from commit `b162cc886c6ab5ff8dfb93ef0f8c4abd2a0a36f2`. Protected [release run `33558108748`](https://github.com/RujitRaval/uiwitness/actions/runs/33558108748) published `uiwitness-core`, `uiwitness-report`, `uiwitness-runner-playwright`, and `uiwitness` at `0.25.5` using trusted-publishing OIDC; the token configuration and bootstrap cleanup steps were skipped. Each npm package exposes SLSA provenance bound to `.github/workflows/release.yml`, `refs/tags/v0.25.5`, and that exact commit. The dependent registry-only job started automatically and passed the check → promotion → scan → open journey with all eight matrix cells. This is the live proof of the normal token-free release path after bootstrap; the separate `v0.25.4` record above remains the bootstrap evidence.

The workflow serializes all npm releases, checks out the release event's commit, proves the named tag still resolves to that exact commit on `main`, rejects prereleases, reruns the complete repository and browser-backed release gates, and packs artifacts once. It publishes missing versions directly to `latest` in dependency order, with the CLI last so its exact supporting dependencies already exist before the primary consumer package moves. A rerun skips a package only when npm reports the same integrity and that exact version is already `latest`; it fails before publication if an existing version has different bytes, a matching version has inconsistent dist-tags, or the requested version is older than any package's current `latest`. npm trusted publishing does not authorize separate dist-tag mutations, so the release path intentionally uses only OIDC-supported publish operations.

Publishing is intentionally absent from pull-request, push, and manual-dispatch workflows. The registry-only public URL gate is also release-only because candidate versions do not exist on npm during pull-request CI.
