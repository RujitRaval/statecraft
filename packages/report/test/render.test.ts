import { calculateCoverage, parseReport, REPORT_SCHEMA_VERSION } from "@statecraft/core";
import { describe, expect, it } from "vitest";

import { renderReportHtml } from "../src/render.js";
import { reportFixture } from "./fixture.js";

describe("renderReportHtml", () => {
  it("renders a polished offline matrix and execution details", () => {
    const html = renderReportHtml(reportFixture());

    expect(html).toMatch(/^<!doctype html>/);
    expect(html).toContain("UI State Coverage Report");
    expect(html).toContain("Coverage matrix");
    expect(html).toContain("../artifacts/dashboard/success/desktop-light.png");
    expect(html).toContain('href="#execution-1"');
    expect(html).toContain('id="execution-2"');
    expect(html).toMatch(/<tbody>[\s\S]*scope="rowgroup"[\s\S]*<\/tbody>/);
    expect(html).toContain("No network or server required");
    expect(html).toContain("default-src 'none'");
    expect(html).not.toMatch(/<(script|link)\b/i);
  });

  it("escapes report-controlled strings in every rendered detail", () => {
    const html = renderReportHtml(reportFixture());

    expect(html).toContain("Widget &lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt; failed");
    expect(html).toContain("Expected &lt;main&gt; content.");
    expect(html).not.toContain("<script>alert('x')</script>");
  });

  it("renders an explicit empty selection without inventing matrix cells", () => {
    const report = parseReport({
      executions: [],
      generatedAt: "2026-08-20T18:00:00.000Z",
      project: { baseURL: "https://statecraft.invalid" },
      schemaVersion: REPORT_SCHEMA_VERSION,
      summary: {
        coverage: calculateCoverage([], []),
        durationMs: 0,
        executions: 0,
        failed: 0,
        passed: 0,
        routes: 0,
        states: 0,
      },
    });

    const html = renderReportHtml(report);

    expect(html).toContain("No executions were selected for this report.");
    expect(html).not.toContain('class="matrix-cell matrix-cell--passed"');
  });
});
