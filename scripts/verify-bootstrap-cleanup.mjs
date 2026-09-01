import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";

import { RELEASE_PACKAGES } from "./check-release-packages.mjs";

export const BOOTSTRAP_CLEANUP_WINDOW_MS = 30 * 60 * 1_000;

const packageNames = RELEASE_PACKAGES.map(({ name }) => name);
const completedOutcomes = new Set(["published", "verified-existing"]);
const attemptOutcomes = new Set([...completedOutcomes, "failed-before-publish"]);

function timestamp(value, label) {
  assert.equal(typeof value, "string", `${label} must be an ISO timestamp.`);
  const milliseconds = Date.parse(value);
  assert.equal(Number.isFinite(milliseconds), true, `${label} must be an ISO timestamp.`);
  return milliseconds;
}

function assertExactPackageOrder(outcomes, label) {
  assert.equal(Array.isArray(outcomes), true, `${label} must be an array.`);
  const indexes = outcomes.map(({ name }) => packageNames.indexOf(name));
  assert.equal(indexes.every((index) => index >= 0), true, `${label} contains an unknown package.`);
  assert.equal(new Set(indexes).size, indexes.length, `${label} repeats a package.`);
  assert.deepEqual([...indexes].sort((left, right) => left - right), indexes, `${label} is not dependency-first.`);
}

export function validateBootstrapCleanupEvidence({ evidence, sha, tag }) {
  const record = typeof evidence === "string" ? JSON.parse(evidence) : evidence;
  assert.equal(record?.schemaVersion, 1, "Cleanup evidence schemaVersion must be 1.");
  assert.equal(record.releaseTag, tag, "Cleanup evidence release tag does not match.");
  assert.equal(record.releaseSha, sha, "Cleanup evidence release SHA does not match.");
  assert.match(tag, /^v(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/u);
  assert.match(sha, /^[0-9a-f]{40}$/u);

  assert.equal(Array.isArray(record.attempts) && record.attempts.length > 0, true, "Cleanup evidence requires at least one bootstrap attempt.");
  const attemptIds = new Set();
  const tokenFingerprints = new Set();
  const finalPackageState = new Map();
  let firstAttemptFinishedAt = Number.POSITIVE_INFINITY;
  let lastCleanupCompletedAt = Number.NEGATIVE_INFINITY;

  for (const [index, attempt] of record.attempts.entries()) {
    const label = `attempts[${index}]`;
    assert.match(attempt.id, /^\d+-\d+$/u, `${label}.id must be <run-id>-<run-attempt>.`);
    assert.equal(attemptIds.has(attempt.id), false, `${label}.id must be unique.`);
    attemptIds.add(attempt.id);
    assert.match(attempt.tokenFingerprint, /^sha256:[0-9a-f]{64}$/u, `${label}.tokenFingerprint is invalid.`);
    assert.equal(tokenFingerprints.has(attempt.tokenFingerprint), false, "Every bootstrap retry must use a fresh token fingerprint.");
    tokenFingerprints.add(attempt.tokenFingerprint);

    const finishedAt = timestamp(attempt.finishedAt, `${label}.finishedAt`);
    const revokedAt = timestamp(attempt.tokenRevokedAt, `${label}.tokenRevokedAt`);
    const deletedAt = timestamp(attempt.githubSecretDeletedAt, `${label}.githubSecretDeletedAt`);
    const cleanupAt = timestamp(attempt.cleanupCompletedAt, `${label}.cleanupCompletedAt`);
    firstAttemptFinishedAt = Math.min(firstAttemptFinishedAt, finishedAt);
    lastCleanupCompletedAt = Math.max(lastCleanupCompletedAt, cleanupAt);
    assert.equal(revokedAt >= finishedAt, true, `${label} token revocation predates workflow completion.`);
    assert.equal(deletedAt >= finishedAt, true, `${label} secret deletion predates workflow completion.`);
    assert.equal(cleanupAt >= Math.max(revokedAt, deletedAt), true, `${label} cleanup completion predates required cleanup actions.`);
    assert.equal(cleanupAt - finishedAt <= BOOTSTRAP_CLEANUP_WINDOW_MS, true, `${label} cleanup exceeded 30 minutes.`);

    assertExactPackageOrder(attempt.packages, `${label}.packages`);
    for (const outcome of attempt.packages) {
      assert.equal(attemptOutcomes.has(outcome.outcome), true, `${label} has an invalid package outcome.`);
      finalPackageState.set(outcome.name, outcome.outcome);
    }
  }

  assert.equal(Array.isArray(record.trustedPublishers), true, "Cleanup evidence requires trusted-publisher records.");
  assert.deepEqual(
    record.trustedPublishers.map(({ name }) => name).sort(),
    [...packageNames].sort(),
    "Cleanup evidence must cover all four trusted publishers exactly once.",
  );
  for (const publisher of record.trustedPublishers) {
    const configuredAt = timestamp(
      publisher.configuredAt,
      `trusted publisher ${publisher.name}.configuredAt`,
    );
    assert.equal(
      configuredAt >= firstAttemptFinishedAt && configuredAt <= lastCleanupCompletedAt,
      true,
      `Trusted publisher ${publisher.name} was not configured during the recorded bootstrap cleanup window.`,
    );
  }
  assert.equal(
    packageNames.every((name) => completedOutcomes.has(finalPackageState.get(name))),
    true,
    "Every package must end published or integrity-verified before registry verification.",
  );

  return Object.freeze({ attempts: record.attempts.length, packages: packageNames.length });
}

function argumentValue(arguments_, name) {
  const index = arguments_.indexOf(name);
  assert.notEqual(index, -1, `${name} is required.`);
  const value = arguments_[index + 1];
  assert.equal(typeof value, "string", `${name} requires a value.`);
  return value;
}

async function main() {
  const arguments_ = process.argv.slice(2);
  const result = validateBootstrapCleanupEvidence({
    evidence: argumentValue(arguments_, "--evidence"),
    sha: argumentValue(arguments_, "--sha"),
    tag: argumentValue(arguments_, "--tag"),
  });
  console.log(`Bootstrap cleanup evidence passed for ${result.attempts} attempt(s) and ${result.packages} packages.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
