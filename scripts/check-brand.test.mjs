import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  checkBrand,
  classifyBrandFindings,
  createBrandContract,
  formatBrandViolation,
  validateBrandContract,
} from "./check-brand.mjs";

const oldLower = ["state", "craft"].join("");
const oldTitle = `${oldLower[0].toUpperCase()}${oldLower.slice(1)}`;

async function makeFixture() {
  return mkdtemp(path.join(tmpdir(), "uiwitness-brand-"));
}

async function write(root, relativePath, contents) {
  const target = path.join(root, relativePath);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, contents);
}

function baseContract(overrides = {}) {
  return {
    schemaVersion: 1,
    migrationBaseline: [],
    permanentAllowlist: [],
    renameRecords: [
      {
        path: "docs/designs/uiwitness-renaming.md",
        allowedLines: [`Rename <legacy-title> to UIWitness.`],
      },
      {
        path: "docs/engineering/UIWITNESS_RENAME_PLAN.md",
        allowedLines: [`Migrate \`<legacy-lower>\` explicitly.`],
      },
    ],
    ...overrides,
  };
}

test("accepts exact-file token budgets, branded paths, and narrow rename-record lines", async (t) => {
  const root = await makeFixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  await write(root, "README.md", `${oldTitle} invokes ${oldLower}.\n`);
  await write(root, `fixtures/${oldLower}.config.ts`, "export {};\n");
  await write(root, "docs/designs/uiwitness-renaming.md", `Rename ${oldTitle} to UIWitness.\n`);
  await write(root, "docs/engineering/UIWITNESS_RENAME_PLAN.md", `Migrate \`${oldLower}\` explicitly.\n`);

  const contract = baseContract({
    migrationBaseline: [
      { path: "README.md", contentCounts: { lower: 1, title: 1 } },
      { path: "fixtures/<legacy-lower>.config.ts", pathCounts: { lower: 1 } },
    ],
  });
  const result = await checkBrand({
    root,
    contract,
    trackedPaths: [
      "README.md",
      `fixtures/${oldLower}.config.ts`,
      "docs/designs/uiwitness-renaming.md",
      "docs/engineering/UIWITNESS_RENAME_PLAN.md",
    ],
  });

  assert.deepEqual(result.violations, []);
  assert.equal(result.findings.length, 5);
});

test("reports unclassified occurrences and exceeded exact-file budgets", () => {
  const findings = [
    { file: "src/new.ts", line: 2, location: "content", matchedValue: oldTitle, variant: "title", lineText: oldTitle },
    { file: "README.md", line: 4, location: "content", matchedValue: oldLower, variant: "lower", lineText: oldLower },
  ];
  const violations = classifyBrandFindings(
    findings,
    baseContract({ migrationBaseline: [{ path: "README.md", contentCounts: { title: 1 } }] }),
  );

  assert.match(violations[0].rule, /no exact-path/u);
  assert.match(violations[1].rule, /budget exceeded/u);
  assert.equal(
    formatBrandViolation(violations[0]),
    `src/new.ts:line 2: matched ${JSON.stringify(oldTitle)}; violated rule: no exact-path allowlist rule`,
  );
});

test("does not inspect private evidence roots even if a path is accidentally supplied", async (t) => {
  const root = await makeFixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  await write(root, `.${oldLower}/report.txt`, `${oldTitle}\n`);
  await write(root, ".uiwitness/report.txt", `${oldTitle}\n`);

  const result = await checkBrand({
    root,
    contract: baseContract(),
    trackedPaths: [`.${oldLower}/report.txt`, ".uiwitness/report.txt"],
  });
  assert.equal(result.textFilesChecked, 0);
  assert.deepEqual(result.findings, []);
  assert.deepEqual(result.violations, []);
});

test("strict release mode rejects migration baselines but preserves historical rules", () => {
  const findings = [
    { file: "README.md", line: 2, location: "content", matchedValue: oldTitle, variant: "title", lineText: oldTitle },
    { file: "CHANGELOG.md", line: 3, location: "content", matchedValue: oldTitle, variant: "title", lineText: oldTitle },
  ];
  const contract = baseContract({
    migrationBaseline: [{ path: "README.md", contentCounts: { title: 1 } }],
    permanentAllowlist: [{ path: "CHANGELOG.md", contentCounts: { title: 1 } }],
  });

  const violations = classifyBrandFindings(findings, contract, { strict: true });
  assert.equal(violations.length, 1);
  assert.equal(violations[0].file, "README.md");
  assert.match(violations[0].rule, /strict release policy/u);
});

test("rejects unrelated old-brand prose in each approved rename record", () => {
  const findings = [
    {
      file: "docs/designs/uiwitness-renaming.md",
      line: 9,
      location: "content",
      matchedValue: oldTitle,
      variant: "title",
      lineText: `${oldTitle} is still the launch name.`,
    },
    {
      file: "docs/engineering/UIWITNESS_RENAME_PLAN.md",
      line: 10,
      location: "content",
      matchedValue: oldLower,
      variant: "lower",
      lineText: `Keep ${oldLower} in active code.`,
    },
  ];

  const violations = classifyBrandFindings(findings, baseContract());
  assert.equal(violations.length, 2);
  assert.ok(violations.every(({ rule }) => rule.includes("exact-line pattern")));
});

test("rejects glob and directory exemptions", () => {
  assert.throws(
    () => validateBrandContract(baseContract({ migrationBaseline: [{ path: "packages/**", contentCounts: { lower: 1 } }] })),
    /exact path/u,
  );
  assert.throws(
    () => validateBrandContract(baseContract({ migrationBaseline: [{ path: "packages/", contentCounts: { lower: 1 } }] })),
    /not a directory exemption/u,
  );
  assert.throws(
    () => validateBrandContract(baseContract({ migrationBaseline: [{ path: "../README.md", contentCounts: { lower: 1 } }] })),
    /not a directory exemption/u,
  );
});

test("generated contracts use exact path templates and exact rename-record lines", async (t) => {
  const root = await makeFixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  await write(root, "README.md", `${oldTitle}\n${oldLower}\n`);
  await write(root, "docs/designs/uiwitness-renaming.md", `Rename ${oldTitle} to UIWitness.\n`);
  await write(root, "docs/engineering/UIWITNESS_RENAME_PLAN.md", `Migrate \`${oldLower}\` explicitly.\n`);

  const contract = await createBrandContract({
    root,
    trackedPaths: [
      "README.md",
      "docs/designs/uiwitness-renaming.md",
      "docs/engineering/UIWITNESS_RENAME_PLAN.md",
    ],
  });

  assert.deepEqual(contract.migrationBaseline, [
    { path: "README.md", contentCounts: { title: 1, lower: 1 } },
  ]);
  assert.deepEqual(contract.permanentAllowlist, []);
  assert.deepEqual(contract.renameRecords[0].allowedLines, ["Rename <legacy-title> to UIWitness."]);
  assert.deepEqual(contract.renameRecords[1].allowedLines, ["Migrate `<legacy-lower>` explicitly."]);
  validateBrandContract(contract);
});
