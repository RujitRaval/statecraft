import { spawnSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const legacyBrand = ["state", "craft"].join("");
const legacyEvidenceRoot = `.${legacyBrand}`;
const defaultContractPath = "scripts/uiwitness-brand-contract.json";
const renameRecordPaths = new Set([
  "docs/designs/uiwitness-renaming.md",
  "docs/engineering/UIWITNESS_RENAME_PLAN.md",
]);
const variantTemplates = {
  lower: "<legacy-lower>",
  title: "<legacy-title>",
  upper: "<legacy-upper>",
};

function legacyPattern(flags = "giu") {
  return new RegExp(legacyBrand, flags);
}

function tokenVariant(value) {
  if (value === legacyBrand) return "lower";
  if (value === `${legacyBrand[0].toUpperCase()}${legacyBrand.slice(1)}`) return "title";
  if (value === legacyBrand.toUpperCase()) return "upper";
  return "mixed";
}

function templateFor(value) {
  return value.replace(legacyPattern(), (match) => variantTemplates[tokenVariant(match)] ?? match);
}

function expandTemplate(value) {
  return value
    .replaceAll(variantTemplates.lower, legacyBrand)
    .replaceAll(variantTemplates.title, `${legacyBrand[0].toUpperCase()}${legacyBrand.slice(1)}`)
    .replaceAll(variantTemplates.upper, legacyBrand.toUpperCase());
}

function countVariants(value) {
  const counts = {};
  for (const match of value.matchAll(legacyPattern())) {
    const variant = tokenVariant(match[0]);
    counts[variant] = (counts[variant] ?? 0) + 1;
  }
  return counts;
}

function validateExactPath(pathTemplate, label) {
  if (!pathTemplate || pathTemplate.startsWith("/") || /^[A-Za-z]:\//u.test(pathTemplate) || /[*?[\]{}]/u.test(pathTemplate)) {
    throw new Error(`${label} must use one repository-relative exact path`);
  }
  const expanded = expandTemplate(pathTemplate);
  if (
    expanded === ".."
    || expanded.startsWith("../")
    || expanded.endsWith("/")
    || path.posix.normalize(expanded) !== expanded
  ) {
    throw new Error(`${label} must use one normalized file path, not a directory exemption`);
  }
  return expanded;
}

export function validateBrandContract(contract) {
  if (contract.schemaVersion !== 1) {
    throw new Error("Brand contract schemaVersion must be 1");
  }

  const seenPaths = new Set();
  for (const [section, entries] of [
    ["migrationBaseline", contract.migrationBaseline],
    ["permanentAllowlist", contract.permanentAllowlist],
    ["renameRecords", contract.renameRecords],
  ]) {
    if (!Array.isArray(entries)) {
      throw new Error(`Brand contract ${section} must be an array`);
    }
    for (const [index, entry] of entries.entries()) {
      const exactPath = validateExactPath(entry.path, `${section}[${index}].path`);
      if (seenPaths.has(exactPath)) {
        throw new Error(`Brand contract repeats exact path: ${exactPath}`);
      }
      seenPaths.add(exactPath);

      for (const field of ["contentCounts", "pathCounts"]) {
        if (entry[field] === undefined) continue;
        for (const [variant, count] of Object.entries(entry[field])) {
          if (!["lower", "title", "upper"].includes(variant) || !Number.isInteger(count) || count < 1) {
            throw new Error(`${section}[${index}].${field} has an invalid token budget`);
          }
        }
      }
      if (section === "renameRecords") {
        if (!renameRecordPaths.has(exactPath)) {
          throw new Error(`Rename-record rules are restricted to approved path: ${exactPath}`);
        }
        if (!Array.isArray(entry.allowedLines) || entry.allowedLines.length === 0) {
          throw new Error(`Rename record ${exactPath} requires narrow allowedLines`);
        }
      } else if (entry.allowedLines !== undefined) {
        throw new Error(`Migration baseline ${exactPath} cannot use rename-record line rules`);
      }
    }
  }

  for (const requiredPath of renameRecordPaths) {
    if (!seenPaths.has(requiredPath)) {
      throw new Error(`Brand contract is missing approved rename record: ${requiredPath}`);
    }
  }
}

function trackedPathsFromGit(root) {
  const result = spawnSync("git", ["ls-files", "-z"], {
    cwd: root,
    encoding: "buffer",
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`git ls-files failed with exit code ${result.status ?? 1}`);
  }
  return result.stdout.toString("utf8").split("\0").filter(Boolean);
}

function decodeText(buffer) {
  if (buffer.includes(0)) return undefined;
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    return undefined;
  }
}

function isPrivateEvidencePath(relativePath) {
  return relativePath === legacyEvidenceRoot || relativePath.startsWith(`${legacyEvidenceRoot}/`)
    || relativePath === ".uiwitness" || relativePath.startsWith(".uiwitness/");
}

export async function collectBrandFindings({ root = process.cwd(), trackedPaths } = {}) {
  const paths = trackedPaths ?? trackedPathsFromGit(root);
  const findings = [];
  let textFilesChecked = 0;

  for (const relativePath of paths) {
    if (isPrivateEvidencePath(relativePath)) continue;
    for (const match of relativePath.matchAll(legacyPattern())) {
      findings.push({
        file: relativePath,
        line: 0,
        lineText: relativePath,
        location: "path",
        matchedValue: match[0],
        variant: tokenVariant(match[0]),
      });
    }

    let buffer;
    try {
      buffer = await readFile(path.join(root, relativePath));
    } catch (error) {
      if (error.code === "ENOENT") continue;
      throw error;
    }
    const contents = decodeText(buffer);
    if (contents === undefined) continue;
    textFilesChecked += 1;

    for (const [lineIndex, lineText] of contents.split("\n").entries()) {
      for (const match of lineText.matchAll(legacyPattern())) {
        findings.push({
          file: relativePath,
          line: lineIndex + 1,
          lineText,
          location: "content",
          matchedValue: match[0],
          variant: tokenVariant(match[0]),
        });
      }
    }
  }

  return { findings, textFilesChecked, trackedPathsChecked: paths.length };
}

function contractRulesByPath(contract) {
  return new Map(
    [
      ...contract.migrationBaseline.map((entry) => ({ ...entry, policy: "migration" })),
      ...contract.permanentAllowlist.map((entry) => ({ ...entry, policy: "permanent" })),
      ...contract.renameRecords.map((entry) => ({ ...entry, policy: "rename-record" })),
    ].map((entry) => [expandTemplate(entry.path), { ...entry, exactPath: expandTemplate(entry.path) }]),
  );
}

export function classifyBrandFindings(findings, contract, { strict = false } = {}) {
  validateBrandContract(contract);
  const rules = contractRulesByPath(contract);
  const consumed = new Map();
  const violations = [];

  for (const finding of findings) {
    const rule = rules.get(finding.file);
    if (!rule) {
      violations.push({ ...finding, rule: "no exact-path allowlist rule" });
      continue;
    }
    if (strict && rule.policy === "migration") {
      violations.push({ ...finding, rule: "strict release policy forbids migration-baseline occurrences" });
      continue;
    }
    if (finding.variant === "mixed") {
      violations.push({ ...finding, rule: "legacy brand uses an unapproved case variant" });
      continue;
    }

    if (rule.allowedLines) {
      if (finding.location === "path") {
        violations.push({ ...finding, rule: "rename-record rule does not allow a branded path" });
        continue;
      }
      const allowedLines = new Set(rule.allowedLines.map(expandTemplate));
      if (!allowedLines.has(finding.lineText)) {
        violations.push({ ...finding, rule: "rename-record exact-line pattern did not match" });
      }
      continue;
    }

    const budgetField = finding.location === "path" ? "pathCounts" : "contentCounts";
    const budget = rule[budgetField]?.[finding.variant] ?? 0;
    const key = `${finding.file}\0${budgetField}\0${finding.variant}`;
    const used = (consumed.get(key) ?? 0) + 1;
    consumed.set(key, used);
    if (used > budget) {
      violations.push({
        ...finding,
        rule: `exact-path ${finding.location} pattern budget exceeded for ${finding.variant} variant (${budget})`,
      });
    }
  }

  return violations;
}

export async function loadBrandContract(root = process.cwd(), contractPath = defaultContractPath) {
  return JSON.parse(await readFile(path.join(root, contractPath), "utf8"));
}

export async function checkBrand({ root = process.cwd(), trackedPaths, contract, strict = false } = {}) {
  const activeContract = contract ?? (await loadBrandContract(root));
  const inventory = await collectBrandFindings({ root, trackedPaths });
  return {
    ...inventory,
    violations: classifyBrandFindings(inventory.findings, activeContract, { strict }),
  };
}

export async function createBrandContract({
  releaseReady = false,
  root = process.cwd(),
  trackedPaths,
} = {}) {
  const inventory = await collectBrandFindings({ root, trackedPaths });
  const findingsByPath = new Map();
  for (const finding of inventory.findings) {
    const list = findingsByPath.get(finding.file) ?? [];
    list.push(finding);
    findingsByPath.set(finding.file, list);
  }

  const migrationBaseline = [];
  const permanentAllowlist = [];
  const renameRecords = [];
  for (const [relativePath, findings] of [...findingsByPath].sort(([left], [right]) => left.localeCompare(right))) {
    const pathFindings = findings.filter((finding) => finding.location === "path");
    const contentFindings = findings.filter((finding) => finding.location === "content");
    if (renameRecordPaths.has(relativePath)) {
      renameRecords.push({
        path: templateFor(relativePath),
        allowedLines: [...new Set(contentFindings.map((finding) => templateFor(finding.lineText)))].sort(),
      });
      continue;
    }
    const entry = {
      path: templateFor(relativePath),
      ...(contentFindings.length > 0 ? { contentCounts: countVariants(contentFindings.map(({ matchedValue }) => matchedValue).join(" ")) } : {}),
      ...(pathFindings.length > 0 ? { pathCounts: countVariants(relativePath) } : {}),
    };
    if (
      releaseReady ||
      relativePath === "CHANGELOG.md" ||
      relativePath.startsWith("docs/decisions/")
    ) {
      permanentAllowlist.push(entry);
    } else {
      migrationBaseline.push(entry);
    }
  }

  return {
    schemaVersion: 1,
    description: releaseReady
      ? "Release-ready exact-file allowlist. Every retained legacy occurrence is intentional; new occurrences fail."
      : "Exact-file migration ratchet. Token budgets may decrease; new legacy-brand occurrences fail.",
    migrationBaseline,
    permanentAllowlist,
    renameRecords,
  };
}

export function formatBrandViolation(violation) {
  const location = violation.line === 0 ? "line 0 (path)" : `line ${violation.line}`;
  return `${violation.file}:${location}: matched ${JSON.stringify(violation.matchedValue)}; violated rule: ${violation.rule}`;
}

async function main() {
  const root = process.cwd();
  if (
    process.argv.includes("--write-contract") ||
    process.argv.includes("--write-release-contract")
  ) {
    const contract = await createBrandContract({
      releaseReady: process.argv.includes("--write-release-contract"),
      root,
    });
    validateBrandContract(contract);
    await writeFile(path.join(root, defaultContractPath), `${JSON.stringify(contract, null, 2)}\n`);
    console.log(
      `Brand contract written (${contract.migrationBaseline.length} migration paths, ${contract.permanentAllowlist.length} permanent paths, ${contract.renameRecords.length} rename records).`,
    );
    return;
  }

  const result = await checkBrand({ root, strict: process.argv.includes("--strict") });
  if (result.violations.length > 0) {
    console.error(`Brand contract failed (${result.violations.length} violations):`);
    for (const violation of result.violations) console.error(`- ${formatBrandViolation(violation)}`);
    process.exitCode = 1;
    return;
  }
  console.log(
    `Brand contract passed (${result.findings.length} classified matches across ${result.textFilesChecked} tracked text files).`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
