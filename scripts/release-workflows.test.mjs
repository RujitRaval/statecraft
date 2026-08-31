import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const releaseWorkflowPath = path.join(root, ".github", "workflows", "release.yml");
const verificationWorkflowPath = path.join(
  root,
  ".github",
  "workflows",
  "verify-registry-release.yml",
);

test("bootstrap publication cannot automatically start registry verification", async () => {
  const workflow = await readFile(releaseWorkflowPath, "utf8");
  const verificationJob = workflow.slice(workflow.indexOf("  verify-public-url:"));

  assert.match(workflow, /NPM_BOOTSTRAP_TOKEN_PRESENT: \$\{\{ secrets\.NPM_TOKEN != '' \}\}/u);
  assert.match(workflow, /bootstrap: \$\{\{ steps\.release-mode\.outputs\.bootstrap \}\}/u);
  assert.match(
    verificationJob,
    /if: \$\{\{ needs\.publish-npm\.result == 'success' && needs\.publish-npm\.outputs\.bootstrap == 'false' \}\}/u,
  );
  assert.match(workflow, /Use a fresh token for every retry\./u);
  assert.match(
    workflow,
    /if: \$\{\{ always\(\) && env\.NPM_BOOTSTRAP_TOKEN_PRESENT == 'true' \}\}/u,
  );
  assert.equal((workflow.match(/NODE_AUTH_TOKEN: \$\{\{ secrets\.NPM_TOKEN \}\}/gu) ?? []).length, 1);
});

test("normal OIDC publication remains token-free and automatically gates on the registry journey", async () => {
  const workflow = await readFile(releaseWorkflowPath, "utf8");
  const verificationJob = workflow.slice(workflow.indexOf("  verify-public-url:"));

  assert.match(verificationJob, /needs: publish-npm/u);
  assert.match(verificationJob, /RELEASE_SHA: \$\{\{ needs\.publish-npm\.outputs\.release-sha \}\}/u);
  assert.match(verificationJob, /test "\$\(git rev-parse HEAD\)" = "\$RELEASE_SHA"/u);
  assert.match(
    verificationJob,
    /node scripts\/public-url-registry-smoke\.mjs --tag "\$RELEASE_TAG" --with-deps/u,
  );
  assert.doesNotMatch(verificationJob, /NPM_TOKEN|NODE_AUTH_TOKEN/u);
});

test("manual bootstrap verification binds cleanup evidence to an immutable release tag and SHA", async () => {
  const workflow = await readFile(verificationWorkflowPath, "utf8");

  assert.match(workflow, /workflow_dispatch:/u);
  assert.match(workflow, /release_tag:[\s\S]*required: true[\s\S]*cleanup_evidence:[\s\S]*required: true/u);
  assert.match(workflow, /ref: \$\{\{ inputs\.release_tag \}\}/u);
  assert.match(workflow, /fetch-depth: 0/u);
  assert.match(workflow, /refs\/tags\/\$\{RELEASE_TAG\}\^\{commit\}/u);
  assert.match(workflow, /git merge-base --is-ancestor "\$RELEASE_SHA" origin\/main/u);
  assert.match(workflow, /node scripts\/check-release-packages\.mjs --tag "\$RELEASE_TAG"/u);
  assert.match(workflow, /gh release view "\$RELEASE_TAG" --json tagName/u);
  assert.match(workflow, /gh release view "\$RELEASE_TAG" --json isDraft --jq \.isDraft/u);
  assert.match(
    workflow,
    /gh release view "\$RELEASE_TAG" --json isPrerelease --jq \.isPrerelease/u,
  );
  assert.match(workflow, /node scripts\/verify-bootstrap-cleanup\.mjs/u);
  assert.match(workflow, /--sha "\$\{\{ steps\.release\.outputs\.release-sha \}\}"/u);
  assert.match(workflow, /node scripts\/public-url-registry-smoke\.mjs --tag "\$RELEASE_TAG" --with-deps/u);
  assert.doesNotMatch(workflow, /secrets\.NPM_TOKEN|NODE_AUTH_TOKEN|id-token: write/u);
});
