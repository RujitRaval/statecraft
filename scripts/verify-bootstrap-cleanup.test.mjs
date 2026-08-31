import assert from "node:assert/strict";
import test from "node:test";

import {
  BOOTSTRAP_CLEANUP_WINDOW_MS,
  validateBootstrapCleanupEvidence,
} from "./verify-bootstrap-cleanup.mjs";

const tag = "v0.25.3";
const sha = "a".repeat(40);
const names = [
  "uiwitness-core",
  "uiwitness-report",
  "uiwitness-runner-playwright",
  "uiwitness",
];

function evidence() {
  return {
    schemaVersion: 1,
    releaseTag: tag,
    releaseSha: sha,
    attempts: [
      {
        id: "123-1",
        tokenFingerprint: `sha256:${"1".repeat(64)}`,
        finishedAt: "2026-08-31T20:00:00.000Z",
        tokenRevokedAt: "2026-08-31T20:05:00.000Z",
        githubSecretDeletedAt: "2026-08-31T20:06:00.000Z",
        cleanupCompletedAt: "2026-08-31T20:07:00.000Z",
        packages: names.map((name) => ({ name, outcome: "published" })),
      },
    ],
    trustedPublishers: names.map((name) => ({
      name,
      configuredAt: "2026-08-31T20:04:00.000Z",
    })),
  };
}

test("accepts tag-bound cleanup evidence for a complete bootstrap", () => {
  assert.deepEqual(validateBootstrapCleanupEvidence({ evidence: evidence(), sha, tag }), {
    attempts: 1,
    packages: 4,
  });
});

test("accepts integrity-safe partial publication recovery with fresh tokens", () => {
  const record = evidence();
  record.attempts[0].packages = [
    { name: names[0], outcome: "published" },
    { name: names[1], outcome: "failed-before-publish" },
  ];
  record.attempts.push({
    id: "123-2",
    tokenFingerprint: `sha256:${"2".repeat(64)}`,
    finishedAt: "2026-08-31T20:10:00.000Z",
    tokenRevokedAt: "2026-08-31T20:12:00.000Z",
    githubSecretDeletedAt: "2026-08-31T20:13:00.000Z",
    cleanupCompletedAt: "2026-08-31T20:14:00.000Z",
    packages: [
      { name: names[0], outcome: "verified-existing" },
      { name: names[1], outcome: "published" },
      { name: names[2], outcome: "published" },
      { name: names[3], outcome: "published" },
    ],
  });
  assert.deepEqual(validateBootstrapCleanupEvidence({ evidence: record, sha, tag }), {
    attempts: 2,
    packages: 4,
  });
});

test("rejects stale cleanup, reused tokens, wrong identity, and incomplete packages", () => {
  const stale = evidence();
  stale.attempts[0].cleanupCompletedAt = new Date(
    Date.parse(stale.attempts[0].finishedAt) + BOOTSTRAP_CLEANUP_WINDOW_MS + 1,
  ).toISOString();
  stale.attempts[0].githubSecretDeletedAt = stale.attempts[0].cleanupCompletedAt;
  assert.throws(() => validateBootstrapCleanupEvidence({ evidence: stale, sha, tag }), /exceeded 30 minutes/u);

  const reused = evidence();
  reused.attempts.push({ ...reused.attempts[0], id: "123-2" });
  assert.throws(() => validateBootstrapCleanupEvidence({ evidence: reused, sha, tag }), /fresh token fingerprint/u);

  assert.throws(
    () => validateBootstrapCleanupEvidence({ evidence: evidence(), sha: "b".repeat(40), tag }),
    /release SHA does not match/u,
  );

  const incomplete = evidence();
  incomplete.attempts[0].packages.pop();
  assert.throws(() => validateBootstrapCleanupEvidence({ evidence: incomplete, sha, tag }), /Every package must end/u);
});

test("rejects malformed attempts, package order, and trusted-publisher evidence", () => {
  const badAttempt = evidence();
  badAttempt.attempts[0].id = "retry-one";
  assert.throws(
    () => validateBootstrapCleanupEvidence({ evidence: badAttempt, sha, tag }),
    /must be <run-id>-<run-attempt>/u,
  );

  const earlyCleanup = evidence();
  earlyCleanup.attempts[0].tokenRevokedAt = "2026-08-31T19:59:00.000Z";
  assert.throws(
    () => validateBootstrapCleanupEvidence({ evidence: earlyCleanup, sha, tag }),
    /token revocation predates workflow completion/u,
  );

  const outOfOrder = evidence();
  outOfOrder.attempts[0].packages.reverse();
  assert.throws(
    () => validateBootstrapCleanupEvidence({ evidence: outOfOrder, sha, tag }),
    /is not dependency-first/u,
  );

  const incompletePublishers = evidence();
  incompletePublishers.trustedPublishers.pop();
  assert.throws(
    () => validateBootstrapCleanupEvidence({ evidence: incompletePublishers, sha, tag }),
    /must cover all four trusted publishers exactly once/u,
  );

  const latePublisher = evidence();
  latePublisher.trustedPublishers[0].configuredAt = "2026-08-31T21:00:00.000Z";
  assert.throws(
    () => validateBootstrapCleanupEvidence({ evidence: latePublisher, sha, tag }),
    /was not configured during the recorded bootstrap cleanup window/u,
  );

  assert.deepEqual(
    validateBootstrapCleanupEvidence({ evidence: JSON.stringify(evidence()), sha, tag }),
    { attempts: 1, packages: 4 },
  );
});
