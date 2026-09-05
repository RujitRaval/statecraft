import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { renderReportHtml } from "../src/render.js";
import { reportFixture } from "./fixture.js";

const digest = `sha256:${"a".repeat(64)}`;

function findings(count: number) {
  return Array.from({ length: count }, (_, index) => {
    const id = `bulk/row-${String(index).padStart(4, "0")}/desktop/light`;
    return index % 2 === 0
      ? {
          actual: { failureCodes: ["ASSERTION_FAILED"], status: "failed" },
          expected: { status: "passed" },
          id,
          kind: "regression",
          remediate: `uiwitness contract inspect --change regression:${id}`,
          reproduce: `uiwitness scan --coordinate ${id}`,
        }
      : {
          actual: { status: "passed" },
          currentConfigFingerprint: digest,
          expected: null,
          id,
          kind: "unaccepted-addition",
          remediate: `uiwitness contract inspect --change addition:${id}`,
        };
  });
}

function renderFindings(count: number): string {
  return renderReportHtml(reportFixture(), {
    contractVerdict: {
      complete: true,
      configDigest: digest,
      contractDigest: digest,
      evaluatedOn: "2026-09-04",
      findings: findings(count),
      runDigest: digest,
      schemaVersion: 1,
      verdict: "failed",
    },
  });
}

describe("contract finding filters", () => {
  it("renders accessible deterministic controls before the canonical ledger", () => {
    const html = renderFindings(4);

    expect(html.indexOf('id="finding-filters"')).toBeLessThan(
      html.indexOf('class="findings-list"'),
    );
    expect(html).toContain('role="search" aria-label="Filter contract findings"');
    expect(html).toContain('name="finding-query" maxlength="256"');
    expect(html).toContain('name="finding-kind"');
    expect(html).toContain('<option value="regression">Regression</option>');
    expect(html).toContain(
      '<option value="unaccepted-addition">Unaccepted drift</option>',
    );
    expect(html).toContain(
      'id="finding-filter-results" aria-live="polite" aria-atomic="true">Showing 4 findings.',
    );
    expect(html).toContain('data-contract-coordinate="bulk/row-0000/desktop/light"');
    expect(html.indexOf("bulk/row-0000/desktop/light")).toBeLessThan(
      html.indexOf("bulk/row-0003/desktop/light"),
    );
  });

  it("keeps filter behavior CSP-pinned and every finding visible without script", () => {
    const html = renderFindings(2);
    const script = html.match(/<script>([\s\S]*)<\/script>/i)?.[1] ?? "";
    const cspHash = html.match(/script-src 'sha256-([^']+)'/)?.[1];

    expect(script).not.toContain("bulk/row-0000/desktop/light");
    expect(cspHash).toBe(createHash("sha256").update(script).digest("base64"));
    expect(html).toContain("html:not(.js) .finding-filter-rail{display:none}");
    expect(html.match(/data-contract-finding=/g)).toHaveLength(2);
    expect(html).not.toContain('data-contract-finding="regression" hidden');
  });

  it("renders thousands of findings without truncation or order drift", () => {
    const html = renderFindings(2_000);

    expect(html.match(/data-contract-finding=/g)).toHaveLength(2_000);
    expect(html).toContain("Showing 2000 findings.");
    expect(html.indexOf("bulk/row-0000/desktop/light")).toBeLessThan(
      html.indexOf("bulk/row-1999/desktop/light"),
    );
    expect(html).toContain("Full local output is never truncated.");
  });
});
