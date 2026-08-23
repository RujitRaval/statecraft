# ADR 0027: Release Package Metadata and Automation

## Status

Accepted on 2026-08-21.

## Context

Phase 7 needs installable npm artifacts, not merely workspace builds. The original internal names used the `@statecraft` scope, but that scope is not controlled by this repository and `@statecraft/core` is already owned by an unrelated publisher. Publishing under those names would either fail or misrepresent package ownership. The repository also uses a four-component `VERSION` file while npm accepts semantic versions with three numeric components.

A multi-package publication can fail after some dependencies are public. Retrying must never overwrite an existing version or silently accept a package whose published bytes differ from the locally verified artifact. npm trusted publishing removes long-lived automation tokens, but it can only be configured after each package exists.

## Decision

Publish the executable package as `statecraft-ui` while retaining the `statecraft` binary, and publish its supporting packages as `statecraft-ui-core`, `statecraft-ui-report`, and `statecraft-ui-runner-playwright`. Give each package a narrow `dist` allowlist, package-specific README, MIT license, exact repository directory, Node engine, ESM export and type declarations, public provenance-enabled publish configuration, and exact internal versions produced from `workspace:*` dependencies.

Treat `VERSION` as the release source of truth. The release validator maps `MAJOR.MINOR.PATCH.0` to npm's `MAJOR.MINOR.PATCH`, synchronizes the root and public manifests, and rejects any nonzero fourth component because it cannot be represented without a collision. Release tags must be exactly `vMAJOR.MINOR.PATCH`.

Before publication, pack every public workspace, run npm's publish dry run, install all four tarballs into an isolated consumer, import each public API, execute CLI help, and run `statecraft init`. Serialize releases and publish the exact verified tarballs directly to `latest` in dependency order from a GitHub Release workflow pinned to Node 24.19.0. Publish the CLI last so its exact supporting versions already exist before the primary consumer package moves. The publisher checks npm before each upload: matching package/version integrity at `latest` is a safe retry and is skipped; differing integrity, inconsistent dist-tags, or a requested version older than current `latest` is a hard failure. Avoid separate dist-tag commands because npm trusted publishing authorizes publication but not dist-tag mutation.

Run the post-publication registry consumer on the first release-workflow attempt with a ten-minute propagation window inside a 25-minute job. Every retry uses `--prefer-online` and a distinct cache beneath the temporary consumer so npm revalidates registry metadata instead of reusing a cached missing-version response. Keep exact package versions, the explicit npmjs registry, permanent-error fail-fast behavior, and final consumer cleanup unchanged.

Use npm trusted publishing with GitHub Actions OIDC after the packages exist. For the first publication only, permit a short-lived `All Packages` write token with bypass-2FA because npm cannot scope a token to an unclaimed name. Store it only as the `NPM_TOKEN` secret in a protected `npm-publish` GitHub Environment with maintainer approval. Revoke and remove that token immediately after configuring each package's trusted publisher for `.github/workflows/release.yml` and the same Environment.

## Consequences

- Package names are globally unscoped and do not depend on an npm organization owned outside this repository.
- A non-prerelease GitHub Release is the only automatic publication trigger; pull-request and branch workflows cannot publish, and the protected Environment requires human approval.
- Release verification exercises the same tarballs consumers install, including the transitive workspace dependency rewrite.
- Partially completed publications are resumable when registry bytes and dist-tags match, while serialized releases, dependency order, CLI-last publication, and a monotonic latest-version gate prevent older release events from moving consumers backward.
- The live-registry proof can tolerate delayed package visibility without depending on a fresh runner or an unbounded retry, at the cost of a longer worst-case release workflow.
- The one-time bootstrap token is a documented release operation, not a committed secret or permanent automation credential.
- The fourth repository version component must remain zero for every npm release.
