import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { renderReportHtml } from "../src/render.js";
import { reportFixture } from "./fixture.js";

const digest = `sha256:${"a".repeat(64)}`;

function verdictFixture() {
  return {
    complete: true,
    configDigest: digest,
    contractDigest: digest,
    evaluatedOn: "2026-09-04",
    findings: [
      {
        actual: { failureCodes: ["ASSERTION_FAILED"], status: "failed" },
        expected: { status: "passed" },
        id: "dashboard/error/desktop/dark",
        kind: "regression",
        remediate:
          "uiwitness contract inspect --candidate '<candidate>&.json' --change regression:dashboard/error/desktop/dark",
        reproduce:
          "uiwitness scan --coordinate dashboard/error/desktop/dark --headed",
      },
      {
        actual: { status: "passed" },
        expected: { status: "passed" },
        id: "dashboard/success/desktop/light",
        kind: "matched",
      },
      {
        actual: { failureCodes: ["PAGE_ERROR"], status: "failed" },
        expected: {
          exception: {
            createdOn: "2026-09-01",
            expiresOn: "2026-09-15",
            owner: "checkout-team",
            reason: "UIW-1842 tracks the repair",
          },
          failureCodes: ["PAGE_ERROR"],
          status: "failed",
        },
        id: "orders/error/mobile/dark",
        kind: "matched-known-failure",
      },
    ],
    runDigest: digest,
    schemaVersion: 1 as const,
    verdict: "failed" as const,
  };
}

describe("contract-first report", () => {
  it("leads with the verdict, actionable findings, commands, and digest details", () => {
    const html = renderReportHtml(reportFixture(), {
      contractVerdict: verdictFixture(),
    });

    expect(html).toContain("<title>UIWitness · Contract Verdict Report</title>");
    expect(html).toContain('data-contract-verdict="failed"');
    expect(html).toContain("Contract<br>broken.");
    expect(html).toContain("3 promises · 2 matched coordinates · 1 regression · 1 known failure");
    expect(html.indexOf('id="contract-findings"')).toBeLessThan(
      html.indexOf('id="matrix"'),
    );
    expect(html).toContain('data-contract-finding="regression"');
    expect(html).toContain('data-contract-finding="matched-known-failure"');
    expect(html).not.toContain('data-contract-finding="matched"');
    expect(html).toContain("Expected");
    expect(html).toContain("Actual");
    expect(html).toContain("Failed · ASSERTION_FAILED");
    expect(html).toContain("checkout-team");
    expect(html).toContain("UIW-1842 tracks the repair");
    expect(html).toContain("2026-09-01 → 2026-09-15");
    expect(html).toContain("uiwitness scan --coordinate dashboard/error/desktop/dark --headed");
    expect(html).toContain("&lt;candidate&gt;&amp;.json");
    expect(html).toContain('data-copy-target="finding-');
    expect(html).toContain('id="copy-status" aria-live="polite"');
    expect(html).toContain("window.setTimeout(() => {");
    expect(html).toContain("}, 120);");
    expect(html).toContain("Contract / run / generation details");
    expect(html).toContain(digest);
    expect(html).toContain("Coverage matrix");
    expect(html).toContain("Inspection room / execution-1");
  });

  it("renders a calm promise-kept state without inventing findings", () => {
    const html = renderReportHtml(reportFixture(), {
      contractVerdict: {
        ...verdictFixture(),
        findings: verdictFixture().findings.filter(({ kind }) => kind === "matched"),
        verdict: "passed",
      },
    });

    expect(html).toContain('data-contract-verdict="passed"');
    expect(html).toContain("Promise<br>kept.");
    expect(html).toContain("No contract findings.");
    expect(html).toContain("Every promised coordinate matched this complete run.");
  });

  it("counts an active known-failure match as a kept promise", () => {
    const html = renderReportHtml(reportFixture(), {
      contractVerdict: {
        ...verdictFixture(),
        findings: verdictFixture().findings.filter(
          ({ kind }) => kind === "matched-known-failure",
        ),
        verdict: "passed",
      },
    });

    expect(html).toContain("1 promise · 1 matched coordinate · 1 known failure");
  });

  it("keeps report data out of the CSP-pinned interaction script", () => {
    const html = renderReportHtml(reportFixture(), {
      contractVerdict: verdictFixture(),
    });
    const script = html.match(/<script>([\s\S]*)<\/script>/i)?.[1] ?? "";
    const cspHash = html.match(/script-src 'sha256-([^']+)'/)?.[1];

    expect(script).not.toContain("dashboard/error/desktop/dark");
    expect(cspHash).toBe(createHash("sha256").update(script).digest("base64"));
  });

  it.each([
    ["run-error", "Incomplete run", "error", false],
    ["unaccepted-addition", "Unaccepted drift", "failed", true],
    ["missing-coordinate", "Unaccepted drift", "failed", true],
    ["unaccepted-config-drift", "Unaccepted drift", "failed", true],
    ["expired-exception", "Expired exception", "failed", true],
    ["regression", "Regression", "failed", true],
    ["changed-known-failure", "Changed known failure", "failed", true],
    ["recovered-known-failure", "Recovered known failure", "failed", true],
    ["matched-known-failure", "Known failure", "passed", true],
  ] as const)(
    "renders the %s contract state with fixed product language",
    (kind, label, verdict, complete) => {
      const failedExpectation = {
        exception: {
          createdOn: "2026-09-01",
          expiresOn: "2026-09-15",
          owner: "quality-team",
          reason: "Tracked debt",
        },
        failureCodes: ["ASSERTION_FAILED"],
        status: "failed",
      };
      const expiredExpectation = {
        ...failedExpectation,
        exception: {
          ...failedExpectation.exception,
          expiresOn: "2026-09-03",
        },
      };
      const finding = kind === "run-error"
        ? { id: null, kind, reasons: ["declared-incomplete"] }
        : kind === "unaccepted-addition"
          ? {
              actual: { status: "passed" },
              currentConfigFingerprint: digest,
              expected: null,
              id: "a/b/c/d",
              kind,
            }
          : kind === "missing-coordinate"
            ? {
                actual: null,
                contractConfigFingerprint: digest,
                expected: { status: "passed" },
                id: "a/b/c/d",
                kind,
              }
            : kind === "regression"
              ? {
                  actual: { failureCodes: ["ASSERTION_FAILED"], status: "failed" },
                  expected: { status: "passed" },
                  id: "a/b/c/d",
                  kind,
                }
              : kind === "recovered-known-failure"
                ? {
                    actual: { status: "passed" },
                    expected: failedExpectation,
                    id: "a/b/c/d",
                    kind,
                  }
                : {
                    actual: kind === "unaccepted-config-drift"
                      ? { status: "passed" }
                      : {
                          failureCodes: [
                            kind === "changed-known-failure"
                              ? "PAGE_ERROR"
                              : "ASSERTION_FAILED",
                          ],
                          status: "failed",
                        },
                    ...(kind === "unaccepted-config-drift"
                      ? {
                          contractConfigFingerprint: digest,
                          currentConfigFingerprint: `sha256:${"b".repeat(64)}`,
                        }
                      : {}),
                    expected: kind === "unaccepted-config-drift"
                      ? { status: "passed" }
                      : kind === "expired-exception"
                        ? expiredExpectation
                        : failedExpectation,
                    id: "a/b/c/d",
                    kind,
                  };
      const findingWithCommands = {
        ...finding,
        ...(kind !== "run-error" && kind !== "matched-known-failure"
          ? { remediate: "uiwitness contract inspect --candidate proposal.json --change selected" }
          : {}),
        ...(kind === "regression" ||
            kind === "changed-known-failure" ||
            kind === "recovered-known-failure"
          ? { reproduce: "uiwitness scan --coordinate a/b/c/d --headed" }
          : {}),
      };
      const html = renderReportHtml(reportFixture(), {
        contractVerdict: {
          ...verdictFixture(),
          complete,
          findings: [findingWithCommands],
          verdict,
        },
      });

      expect(html).toContain(`data-contract-finding="${kind}"`);
      expect(html).toContain(label);
    },
  );

  it("fails closed for malformed, inconsistent, or noncanonical verdicts", () => {
    expect(() =>
      renderReportHtml(reportFixture(), {
        contractVerdict: { ...verdictFixture(), schemaVersion: 2 as 1 },
      })
    ).toThrow("schemaVersion must be 1");

    expect(() =>
      renderReportHtml(reportFixture(), {
        contractVerdict: { ...verdictFixture(), verdict: "passed" },
      })
    ).toThrow("status does not match its findings");

    expect(() =>
      renderReportHtml(reportFixture(), {
        contractVerdict: { ...verdictFixture(), evaluatedOn: "2026-02-31" },
      })
    ).toThrow("evaluatedOn must be a real");

    expect(() =>
      renderReportHtml(reportFixture(), {
        contractVerdict: {
          ...verdictFixture(),
          findings: [],
          verdict: "passed",
        },
      })
    ).toThrow("findings must contain 1 to 10,000");

    expect(() =>
      renderReportHtml(reportFixture(), {
        contractVerdict: {
          ...verdictFixture(),
          findings: [...verdictFixture().findings].reverse(),
        },
      })
    ).toThrow("canonical order");
  });

  it.each([
    [
      "matched actual failure",
      { actual: { failureCodes: ["ASSERTION_FAILED"], status: "failed" } },
      "actual must have status passed",
    ],
    [
      "missing coordinate with an actual outcome",
      { actual: { status: "passed" }, kind: "missing-coordinate" },
      "actual must be null",
    ],
    [
      "known failure without a failed expectation",
      {
        actual: { failureCodes: ["ASSERTION_FAILED"], status: "failed" },
        expected: { status: "passed" },
        kind: "matched-known-failure",
      },
      "expected must have status failed",
    ],
  ])("rejects a semantically invalid %s", (_name, overrides, message) => {
    const matched = verdictFixture().findings[1]!;
    expect(() =>
      renderReportHtml(reportFixture(), {
        contractVerdict: {
          ...verdictFixture(),
          findings: [{ ...matched, ...overrides }],
          verdict: "passed",
        },
      })
    ).toThrow(message);
  });

  it("rejects invalid run-error reasons", () => {
    expect(() =>
      renderReportHtml(reportFixture(), {
        contractVerdict: {
          ...verdictFixture(),
          complete: false,
          findings: [{ id: null, kind: "run-error", reasons: ["missing-execution"] }],
          verdict: "error",
        },
      })
    ).toThrow("invalid coordinate/reason combination");
  });

  it.each([
    [
      "declared-incomplete",
      null,
      "The runner declared the execution set incomplete.",
    ],
    [
      "duplicate-execution-coordinate",
      "a/b/c/d",
      "This coordinate was executed more than once.",
    ],
    [
      "missing-execution",
      "a/b/c/d",
      "This promised coordinate was not executed.",
    ],
    [
      "unexpected-execution",
      "a/b/c/d",
      "A coordinate outside the current configuration was executed.",
    ],
  ] as const)(
    "preserves and explains the %s run-error reason",
    (reason, id, explanation) => {
      const html = renderReportHtml(reportFixture(), {
        contractVerdict: {
          ...verdictFixture(),
          complete: false,
          findings: [{ id, kind: "run-error", reasons: [reason] }],
          verdict: "error",
        },
      });

      expect(html).toContain(`<code>${reason}</code>`);
      expect(html).toContain(explanation);
      expect(html).toContain(id ?? "complete run");
    },
  );

  it("rejects declared-incomplete when it names a coordinate", () => {
    expect(() =>
      renderReportHtml(reportFixture(), {
        contractVerdict: {
          ...verdictFixture(),
          complete: false,
          findings: [{
            id: "a/b/c/d",
            kind: "run-error",
            reasons: ["declared-incomplete"],
          }],
          verdict: "error",
        },
      })
    ).toThrow("invalid coordinate/reason combination");
  });

  it.each([
    [
      "run error with reproduction",
      { id: null, kind: "run-error", reasons: ["declared-incomplete"], reproduce: "uiwitness scan" },
      "reproduce is not supported",
    ],
    [
      "structural addition with reproduction",
      {
        actual: { status: "passed" },
        currentConfigFingerprint: digest,
        expected: null,
        id: "a/b/c/d",
        kind: "unaccepted-addition",
        remediate: "uiwitness contract inspect",
        reproduce: "uiwitness scan",
      },
      "reproduce is not supported",
    ],
    [
      "matched coordinate with remediation",
      { ...verdictFixture().findings[1]!, remediate: "uiwitness contract inspect" },
      "remediate is not supported",
    ],
  ])("rejects a %s command", (_name, finding, message) => {
    expect(() =>
      renderReportHtml(reportFixture(), {
        contractVerdict: {
          ...verdictFixture(),
          complete: finding.kind !== "run-error",
          findings: [finding],
          verdict: finding.kind === "run-error" ? "error" : finding.kind === "matched" ? "passed" : "failed",
        },
      })
    ).toThrow(message);
  });

  it.each([
    ["regression reproduction", "reproduce"],
    ["regression remediation", "remediate"],
  ] as const)("rejects missing required %s", (_name, field) => {
    const regression = { ...verdictFixture().findings[0]! } as Record<string, unknown>;
    delete regression[field];
    expect(() =>
      renderReportHtml(reportFixture(), {
        contractVerdict: {
          ...verdictFixture(),
          findings: [regression],
        },
      })
    ).toThrow(`${field} is required for this finding kind`);
  });

  it("rejects a run error mixed with comparison findings", () => {
    expect(() =>
      renderReportHtml(reportFixture(), {
        contractVerdict: {
          ...verdictFixture(),
          complete: false,
          findings: [
            { id: null, kind: "run-error", reasons: ["declared-incomplete"] },
            verdictFixture().findings[1]!,
          ],
          verdict: "error",
        },
      })
    ).toThrow("run errors cannot include comparison findings");
  });

  it("rejects duplicate coordinate-kind identities", () => {
    const matched = verdictFixture().findings[1]!;
    expect(() =>
      renderReportHtml(reportFixture(), {
        contractVerdict: {
          ...verdictFixture(),
          findings: [matched, matched],
          verdict: "passed",
        },
      })
    ).toThrow("must not contain duplicate coordinate kinds");
  });

  it.each(["configDigest", "contractDigest", "runDigest"] as const)(
    "rejects an invalid %s",
    (field) => {
      expect(() =>
        renderReportHtml(reportFixture(), {
          contractVerdict: {
            ...verdictFixture(),
            [field]: "sha256:NOT-LOWERCASE-HEX",
          },
        })
      ).toThrow(`${field} must be a lowercase SHA-256 digest`);
    },
  );

  it.each([
    ["unsupported", ["NOT_A_FAILURE"], "unsupported failure code"],
    [
      "duplicate",
      ["ASSERTION_FAILED", "ASSERTION_FAILED"],
      "must not contain duplicate failure codes",
    ],
    [
      "unsorted",
      ["PAGE_ERROR", "ASSERTION_FAILED"],
      "must use canonical order",
    ],
  ] as const)("rejects %s execution failure codes", (_name, failureCodes, message) => {
    const regression = verdictFixture().findings[0]!;
    expect(() =>
      renderReportHtml(reportFixture(), {
        contractVerdict: {
          ...verdictFixture(),
          findings: [{
            ...regression,
            actual: { failureCodes, status: "failed" },
          }],
        },
      })
    ).toThrow(message);
  });

  it.each([
    ["invalid date", { createdOn: "2026-02-31" }, "must be real YYYY-MM-DD dates"],
    ["zero-day lifetime", { expiresOn: "2026-09-01" }, "must be 1 to 30 calendar days"],
    ["overlong lifetime", { expiresOn: "2026-10-02" }, "must be 1 to 30 calendar days"],
    ["overlong owner", { owner: "o".repeat(1_025) }, "owner must not exceed 1,024"],
    ["overlong reason", { reason: "r".repeat(1_025) }, "reason must not exceed 1,024"],
  ] as const)("rejects an exception with %s", (_name, exceptionOverrides, message) => {
    const knownFailure = verdictFixture().findings[2]!;
    const expected = knownFailure.expected as {
      exception: Record<string, string>;
      failureCodes: readonly string[];
      status: "failed";
    };
    expect(() =>
      renderReportHtml(reportFixture(), {
        contractVerdict: {
          ...verdictFixture(),
          findings: [{
            ...knownFailure,
            expected: {
              ...expected,
              exception: { ...expected.exception, ...exceptionOverrides },
            },
          }],
          verdict: "passed",
        },
      })
    ).toThrow(message);
  });

  it("requires an expired-exception companion for an expired expectation", () => {
    const knownFailure = verdictFixture().findings[2]!;
    const expected = knownFailure.expected as {
      exception: Record<string, string>;
      failureCodes: readonly string[];
      status: "failed";
    };
    expect(() =>
      renderReportHtml(reportFixture(), {
        contractVerdict: {
          ...verdictFixture(),
          findings: [{
            ...knownFailure,
            expected: {
              ...expected,
              exception: { ...expected.exception, expiresOn: "2026-09-03" },
            },
          }],
          verdict: "passed",
        },
      })
    ).toThrow("expired expectations require an expired-exception finding");
  });

  it("rejects equal current and contract config fingerprints", () => {
    expect(() =>
      renderReportHtml(reportFixture(), {
        contractVerdict: {
          ...verdictFixture(),
          findings: [{
            actual: { status: "passed" },
            contractConfigFingerprint: digest,
            currentConfigFingerprint: digest,
            expected: { status: "passed" },
            id: "dashboard/success/desktop/light",
            kind: "unaccepted-config-drift",
          }],
        },
      })
    ).toThrow("config fingerprints must differ");
  });

  it("rejects completeness that disagrees with the finding set", () => {
    expect(() =>
      renderReportHtml(reportFixture(), {
        contractVerdict: { ...verdictFixture(), complete: false },
      })
    ).toThrow("completeness does not match its findings");
  });
});
