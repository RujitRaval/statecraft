# Releasing Statecraft

Statecraft publishes four npm packages from one verified GitHub Release:

| Package | Purpose |
| --- | --- |
| `statecraft-ui-core` | Browser-independent configuration, matrix, coverage, and report contracts |
| `statecraft-ui-report` | Deterministic offline report transformation and rendering |
| `statecraft-ui-runner-playwright` | Playwright execution and local result persistence |
| `statecraft-ui` | Public API and the `statecraft` executable |

The package names were checked for availability when this contract was added. npm names are global and remain unclaimed until the first publication, so the initial release should follow promptly after this branch lands.

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
corepack pnpm --filter statecraft-ui-runner-playwright exec playwright install chromium
node scripts/run-ci.mjs
corepack pnpm release:package-smoke
corepack pnpm release:smoke
```

`release:package-smoke` builds and packs each public workspace, asks npm to validate a dry-run publication, installs the exact tarballs into an isolated project, imports all public APIs, exercises the packed executable, and verifies overwrite-safe initialization. Temporary tarballs are removed and `*.tgz` is ignored.

## First publication bootstrap

npm requires each package to exist before a trusted publisher can be configured. For the first release only:

1. Create a GitHub Environment named `npm-publish`, require a maintainer's approval, and restrict deployment to protected release tags.
2. Create a granular npm access token with `All Packages` read/write permission, bypass-2FA enabled, and the shortest available expiry. npm cannot grant an unclaimed package-specific permission, so this bootstrap credential is temporarily broader than the steady-state publisher.
3. Store the token only as the `NPM_TOKEN` secret in the protected `npm-publish` Environment.
4. Merge a fully green release pull request and create a non-prerelease GitHub Release whose tag exactly matches `VERSION`, for example `v0.24.0`.
5. Approve the protected Environment deployment and wait for the `Release` workflow to verify and publish all four packages.
6. In npm package settings for each package, add the GitHub Actions trusted publisher for repository `RujitRaval/statecraft`, workflow `.github/workflows/release.yml`, and environment `npm-publish`.
7. Delete the `NPM_TOKEN` Environment secret and revoke the token in npm immediately.

The workflow configures token authentication only when that bootstrap secret exists. After bootstrap, GitHub's short-lived OIDC identity supplies publication authority through the workflow's `id-token: write` permission, with no token-style npm configuration present to suppress the OIDC exchange. No npm token should remain configured. The Environment approval remains a deliberate human gate for every registry publication.

## Normal release

1. Start a focused branch from current `main`.
2. Run GStack `review`, then GStack `ship`; ensure the selected four-component version has a zero fourth component and manifests are synchronized.
3. Merge the fully green pull request through GitHub.
4. Create a non-prerelease `vMAJOR.MINOR.PATCH` GitHub Release from the merged commit on `main`.
5. Approve the `npm-publish` Environment deployment.
6. Confirm the `Release` workflow is green and verify all four package versions on npm.

The workflow serializes all npm releases, checks out the release event's commit, proves the named tag still resolves to that exact commit on `main`, rejects prereleases, reruns the complete repository and browser-backed release gates, and packs artifacts once. It publishes missing versions directly to `latest` in dependency order, with the CLI last so its exact supporting dependencies already exist before the primary consumer package moves. A rerun skips a package only when npm reports the same integrity and that exact version is already `latest`; it fails before publication if an existing version has different bytes, a matching version has inconsistent dist-tags, or the requested version is older than any package's current `latest`. npm trusted publishing does not authorize separate dist-tag mutations, so the release path intentionally uses only OIDC-supported publish operations.

Publishing is intentionally absent from pull-request, push, and manual-dispatch workflows.
