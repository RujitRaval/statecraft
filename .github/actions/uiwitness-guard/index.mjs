import { access, appendFile, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";

export const MAXIMUM_SUMMARY_BYTES = 512 * 1024;
export const MAXIMUM_SUMMARY_FINDINGS = 20;
export const MAXIMUM_ANNOTATIONS = 50;
const DEFAULT_ANNOTATIONS = 10;
const DEFAULT_REPORT_PATH = ".uiwitness/report/index.html";
const DEFAULT_VERDICT_PATH = ".uiwitness/contract-verdict.json";
const passingKinds = new Set(["matched", "matched-known-failure"]);
const runErrorReasons = new Set([
  "declared-incomplete",
  "duplicate-execution-coordinate",
  "missing-execution",
  "unexpected-execution",
]);
const executionFailureCodes = new Set([
  "ASSERTION_FAILED",
  "CONSOLE_ERROR",
  "FAILED_REQUEST",
  "INTERNAL_ERROR",
  "NAVIGATION_FAILED",
  "PAGE_ERROR",
  "SCREENSHOT_FAILED",
]);
const contractFailureCodes = new Set([
  "ASSERTION_FAILED",
  "CONSOLE_ERROR",
  "FAILED_REQUEST",
  "PAGE_ERROR",
]);
const coordinatePattern = /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*){3}$/u;
const datePattern = /^\d{4}-\d{2}-\d{2}$/u;
const reproductionKinds = new Set([
  "changed-known-failure",
  "recovered-known-failure",
  "regression",
]);
const remediationKinds = new Set([
  "changed-known-failure",
  "expired-exception",
  "missing-coordinate",
  "recovered-known-failure",
  "regression",
  "unaccepted-addition",
  "unaccepted-config-drift",
]);
const findingOrder = [
  "run-error",
  "unaccepted-addition",
  "missing-coordinate",
  "unaccepted-config-drift",
  "expired-exception",
  "regression",
  "changed-known-failure",
  "recovered-known-failure",
  "matched-known-failure",
  "matched",
];

function oneLineInput(value, label) {
  if (typeof value !== "string") throw new TypeError(`${label} must be a string.`);
  if (value.length > 1_024) throw new TypeError(`${label} must not exceed 1,024 characters.`);
  if (/\p{Cc}/u.test(value)) throw new TypeError(`${label} must not contain control characters.`);
  return value.length === 0 ? undefined : value;
}

function boundedInteger(value, label, minimum, maximum) {
  if (!/^(?:0|[1-9]\d*)$/u.test(value)) {
    throw new TypeError(`${label} must be a whole number from ${minimum} through ${maximum}.`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new TypeError(`${label} must be a whole number from ${minimum} through ${maximum}.`);
  }
  return parsed;
}

export function parseActionInputs(environment) {
  const upload = environment.UIWITNESS_INPUT_UPLOAD_ARTIFACT ?? "false";
  if (upload !== "true" && upload !== "false") {
    throw new TypeError("upload-artifact must be either true or false.");
  }
  return Object.freeze({
    annotationCap: boundedInteger(
      environment.UIWITNESS_INPUT_ANNOTATION_CAP ?? String(DEFAULT_ANNOTATIONS),
      "annotation-cap",
      0,
      MAXIMUM_ANNOTATIONS,
    ),
    config: oneLineInput(environment.UIWITNESS_INPUT_CONFIG ?? "", "config"),
    contract: oneLineInput(environment.UIWITNESS_INPUT_CONTRACT ?? "", "contract"),
    retentionDays: boundedInteger(
      environment.UIWITNESS_INPUT_RETENTION_DAYS ?? "1",
      "retention-days",
      1,
      90,
    ),
    uploadArtifact: upload === "true",
  });
}

export function normalizeActionVersion(source) {
  const match = /^((?:0|[1-9]\d*))\.((?:0|[1-9]\d*))\.((?:0|[1-9]\d*))\.0(?:\r?\n)?$/u.exec(source);
  if (match === null) {
    throw new TypeError("The Action VERSION must be MAJOR.MINOR.PATCH.0.");
  }
  return `${match[1]}.${match[2]}.${match[3]}`;
}

function markdown(value) {
  return String(value)
    .replaceAll("\\", "\\\\")
    .replaceAll("`", "\\`")
    .replaceAll("*", "\\*")
    .replaceAll("_", "\\_")
    .replaceAll("{", "\\{")
    .replaceAll("}", "\\}")
    .replaceAll("[", "\\[")
    .replaceAll("]", "\\]")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("|", "\\|")
    .replace(/[\r\n\t\p{Cc}]/gu, " ");
}

function workflowMessage(value) {
  return String(value)
    .replaceAll("%", "%25")
    .replaceAll("\r", "%0D")
    .replaceAll("\n", "%0A")
    .replaceAll(":", "%3A")
    .replaceAll(",", "%2C")
    .replace(/[\p{Cc}]/gu, "?");
}

function workflowProperty(value) {
  return workflowMessage(value);
}

function safeLog(value) {
  return String(value)
    .split(/\r?\n/u)
    .filter((line, index, lines) => line.length > 0 || index < lines.length - 1)
    .map((line) => `[uiwitness] ${line
      .replace(/[\r\t\p{Cc}]/gu, " ")
      .replaceAll("::", ":%3A")
      .replaceAll("##[", "##%5B")}`)
    .join("\n");
}

function record(value, label) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object.`);
  }
  return value;
}

function requiredString(value, label) {
  if (typeof value !== "string" || value.trim().length === 0 || value.length > 1_024 || /\p{Cc}/u.test(value)) {
    throw new TypeError(`${label} must be a non-empty bounded string.`);
  }
  return value;
}

function contractMetadata(value, label) {
  if (typeof value !== "string" || value.trim().length === 0 || value.length > 1_024) {
    throw new TypeError(`${label} must be a non-empty bounded string.`);
  }
  return value;
}

function assertOnlyKeys(value, keys, label) {
  const allowed = new Set(keys);
  const unexpected = Object.keys(value).find((key) => !allowed.has(key));
  if (unexpected !== undefined) throw new TypeError(`${label}.${unexpected} is not supported.`);
}

function coordinate(value, label) {
  const selected = requiredString(value, label);
  if (!coordinatePattern.test(selected)) throw new TypeError(`${label} is not a canonical coordinate.`);
  return selected;
}

function validDate(value, label) {
  const selected = requiredString(value, label);
  const instant = new Date(`${selected}T00:00:00.000Z`);
  if (!datePattern.test(selected) || selected.startsWith("0000-") ||
      !Number.isFinite(instant.valueOf()) || instant.toISOString().slice(0, 10) !== selected) {
    throw new TypeError(`${label} must be a real YYYY-MM-DD date.`);
  }
  return selected;
}

function digest(value, label) {
  if (typeof value !== "string" || !/^sha256:[0-9a-f]{64}$/u.test(value)) {
    throw new TypeError(`${label} is invalid.`);
  }
  return value;
}

function failureCodes(value, label, supported) {
  if (!Array.isArray(value) || value.length === 0 || value.some((code) => typeof code !== "string" || !supported.has(code))) {
    throw new TypeError(`${label} must contain failure codes.`);
  }
  if (new Set(value).size !== value.length || [...value].sort().some((code, index) => code !== value[index])) {
    throw new TypeError(`${label} must contain unique sorted failure codes.`);
  }
  return value;
}

function outcome(value, label) {
  const selected = record(value, label);
  if (selected.status === "passed") {
    assertOnlyKeys(selected, ["status"], label);
    return Object.freeze({ status: "passed" });
  }
  if (selected.status === "failed") {
    assertOnlyKeys(selected, ["failureCodes", "status"], label);
    return Object.freeze({ failureCodes: Object.freeze([...failureCodes(selected.failureCodes, `${label}.failureCodes`, executionFailureCodes)]), status: "failed" });
  }
  throw new TypeError(`${label}.status is invalid.`);
}

function expectation(value, label) {
  const selected = record(value, label);
  if (selected.status === "passed") {
    assertOnlyKeys(selected, ["status"], label);
    return Object.freeze({ exception: null, status: "passed" });
  }
  if (selected.status !== "failed") throw new TypeError(`${label}.status is invalid.`);
  assertOnlyKeys(selected, ["exception", "failureCodes", "status"], label);
  const selectedException = record(selected.exception, `${label}.exception`);
  assertOnlyKeys(selectedException, ["createdOn", "expiresOn", "owner", "reason"], `${label}.exception`);
  const createdOn = validDate(selectedException.createdOn, `${label}.exception.createdOn`);
  const expiresOn = validDate(selectedException.expiresOn, `${label}.exception.expiresOn`);
  const lifetimeDays = (Date.parse(`${expiresOn}T00:00:00.000Z`) - Date.parse(`${createdOn}T00:00:00.000Z`)) / 86_400_000;
  if (lifetimeDays < 1 || lifetimeDays > 30) throw new TypeError(`${label}.exception must expire 1 to 30 days after creation.`);
  return Object.freeze({
    exception: Object.freeze({
      createdOn,
      expiresOn,
      owner: contractMetadata(selectedException.owner, `${label}.exception.owner`),
      reason: contractMetadata(selectedException.reason, `${label}.exception.reason`),
    }),
    failureCodes: Object.freeze([...failureCodes(selected.failureCodes, `${label}.failureCodes`, contractFailureCodes)]),
    status: "failed",
  });
}

function sameStrings(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function command(value, label) {
  if (typeof value !== "string" || value.length === 0 || value.length > 8_192 || /\p{Cc}/u.test(value)) {
    throw new TypeError(`${label} must be a non-empty string of at most 8,192 characters.`);
  }
}

function validateFindingShape(finding, label, evaluatedOn) {
  const kind = finding.kind;
  const requiredCommands = [
    ...(reproductionKinds.has(kind) ? ["reproduce"] : []),
    ...(remediationKinds.has(kind) ? ["remediate"] : []),
  ];
  if (kind === "run-error") {
    assertOnlyKeys(finding, ["id", "kind", "reasons"], label);
    if (finding.id !== null) coordinate(finding.id, `${label}.id`);
    if (!Array.isArray(finding.reasons) || finding.reasons.length === 0 ||
        finding.reasons.some((reason) => !runErrorReasons.has(reason))) {
      throw new TypeError(`${label}.reasons is invalid.`);
    }
    if (new Set(finding.reasons).size !== finding.reasons.length ||
        [...finding.reasons].sort().some((reason, index) => reason !== finding.reasons[index])) {
      throw new TypeError(`${label}.reasons must be unique and sorted.`);
    }
    const declaredIncomplete = finding.reasons.includes("declared-incomplete");
    if ((finding.id === null && (finding.reasons.length !== 1 || !declaredIncomplete)) ||
        (finding.id !== null && declaredIncomplete)) {
      throw new TypeError(`${label} has an invalid coordinate/reason combination.`);
    }
    return;
  }
  coordinate(finding.id, `${label}.id`);
  const commonKeys = ["actual", "expected", "id", "kind", ...requiredCommands];
  if (kind === "unaccepted-addition") {
    assertOnlyKeys(finding, [...commonKeys, "currentConfigFingerprint"], label);
    outcome(finding.actual, `${label}.actual`);
    if (finding.expected !== null) throw new TypeError(`${label}.expected must be null.`);
    digest(finding.currentConfigFingerprint, `${label}.currentConfigFingerprint`);
    for (const field of requiredCommands) command(finding[field], `${label}.${field}`);
    return;
  }
  if (kind === "missing-coordinate") {
    assertOnlyKeys(finding, [...commonKeys, "contractConfigFingerprint"], label);
    if (finding.actual !== null) throw new TypeError(`${label}.actual must be null.`);
    expectation(finding.expected, `${label}.expected`);
    digest(finding.contractConfigFingerprint, `${label}.contractConfigFingerprint`);
    for (const field of requiredCommands) command(finding[field], `${label}.${field}`);
    return;
  }
  const driftKeys = kind === "unaccepted-config-drift"
    ? ["contractConfigFingerprint", "currentConfigFingerprint"]
    : [];
  assertOnlyKeys(finding, [...commonKeys, ...driftKeys], label);
  const actual = outcome(finding.actual, `${label}.actual`);
  const expected = expectation(finding.expected, `${label}.expected`);
  for (const field of requiredCommands) command(finding[field], `${label}.${field}`);
  if (kind === "matched" && (actual.status !== "passed" || expected.status !== "passed")) {
    throw new TypeError(`${label} outcomes disagree with matched.`);
  }
  if (kind === "regression" && (actual.status !== "failed" || expected.status !== "passed")) {
    throw new TypeError(`${label} outcomes disagree with regression.`);
  }
  if ((kind === "matched-known-failure" || kind === "changed-known-failure") &&
      (actual.status !== "failed" || expected.status !== "failed" ||
       sameStrings(actual.failureCodes, expected.failureCodes) !== (kind === "matched-known-failure"))) {
    throw new TypeError(`${label} outcomes disagree with ${kind}.`);
  }
  if (kind === "recovered-known-failure" && (actual.status !== "passed" || expected.status !== "failed")) {
    throw new TypeError(`${label} outcomes disagree with recovered-known-failure.`);
  }
  if (kind === "expired-exception" && expected.status !== "failed") {
    throw new TypeError(`${label}.expected must be failed for expired-exception.`);
  }
  if (kind === "expired-exception" && expected.exception.expiresOn >= evaluatedOn) {
    throw new TypeError(`${label}.expected exception is not expired.`);
  }
  if (expected.exception !== null && expected.exception.createdOn > evaluatedOn) {
    throw new TypeError(`${label}.expected exception starts after evaluation.`);
  }
  if (kind === "unaccepted-config-drift") {
    const contractFingerprint = digest(finding.contractConfigFingerprint, `${label}.contractConfigFingerprint`);
    const currentFingerprint = digest(finding.currentConfigFingerprint, `${label}.currentConfigFingerprint`);
    if (contractFingerprint === currentFingerprint) throw new TypeError(`${label} config fingerprints must differ.`);
  }
}

export function parseMachineVerdict(value) {
  const verdict = record(value, "Contract verdict");
  assertOnlyKeys(verdict, ["complete", "configDigest", "contractDigest", "evaluatedOn", "findings", "runDigest", "schemaVersion", "verdict"], "Contract verdict");
  if (verdict.schemaVersion !== 1) throw new TypeError("Contract verdict schemaVersion must be 1.");
  if (typeof verdict.complete !== "boolean") throw new TypeError("Contract verdict complete must be a boolean.");
  if (!["passed", "failed", "error"].includes(verdict.verdict)) {
    throw new TypeError("Contract verdict status is invalid.");
  }
  digest(verdict.configDigest, "Contract verdict configDigest");
  digest(verdict.runDigest, "Contract verdict runDigest");
  const contractDigest = digest(verdict.contractDigest, "Contract verdict contractDigest");
  const evaluatedOn = validDate(verdict.evaluatedOn, "Contract verdict evaluatedOn");
  if (!Array.isArray(verdict.findings) || verdict.findings.length === 0 || verdict.findings.length > 10_000) {
    throw new TypeError("Contract verdict findings must contain 1 to 10,000 entries.");
  }
  const findings = verdict.findings.map((item, index) => {
    const finding = record(item, `Contract verdict finding ${index}`);
    if (!findingOrder.includes(finding.kind)) throw new TypeError(`Contract verdict finding ${index} has an invalid kind.`);
    validateFindingShape(finding, `Contract verdict finding ${index}`, evaluatedOn);
    return Object.freeze({ ...finding });
  });
  const identities = new Set();
  const findingsByCoordinate = new Map();
  for (const [index, finding] of findings.entries()) {
    const identity = `${finding.id ?? ""}\u0000${finding.kind}`;
    if (identities.has(identity)) throw new TypeError("Contract verdict findings must be unique.");
    identities.add(identity);
    if (finding.id !== null) {
      const group = findingsByCoordinate.get(finding.id) ?? [];
      group.push(finding);
      findingsByCoordinate.set(finding.id, group);
    }
    if (index > 0) {
      const previous = findings[index - 1];
      const previousId = previous.id ?? "";
      const currentId = finding.id ?? "";
      if (previousId > currentId || (previousId === currentId && findingOrder.indexOf(previous.kind) > findingOrder.indexOf(finding.kind))) {
        throw new TypeError("Contract verdict findings must use canonical order.");
      }
    }
  }
  const runError = findings.some((finding) => finding.kind === "run-error");
  if (runError && findings.some((finding) => finding.kind !== "run-error")) {
    throw new TypeError("Contract verdict run errors cannot include comparison findings.");
  }
  if (!runError) {
    const allowedPairs = new Set([
      "unaccepted-config-drift,expired-exception",
      "expired-exception,changed-known-failure",
      "expired-exception,recovered-known-failure",
      "expired-exception,matched-known-failure",
    ]);
    for (const group of findingsByCoordinate.values()) {
      if (group.length > 2 || (group.length === 2 && !allowedPairs.has(group.map(({ kind }) => kind).join(",")))) {
        throw new TypeError("Contract verdict contains an impossible coordinate finding combination.");
      }
      if (group.length === 2 &&
          (JSON.stringify(group[0].actual) !== JSON.stringify(group[1].actual) ||
           JSON.stringify(group[0].expected) !== JSON.stringify(group[1].expected))) {
        throw new TypeError("Contract verdict coordinate findings disagree on outcomes.");
      }
      const expired = group.some(({ kind }) => kind === "expired-exception");
      if (group.length === 1 && expired) {
        throw new TypeError("Contract verdict expired exception is missing its coordinate outcome.");
      }
      const requiresExpired = group.some((finding) =>
        finding.kind !== "missing-coordinate" && finding.expected?.status === "failed" &&
        finding.expected.exception.expiresOn < evaluatedOn
      );
      if (requiresExpired !== expired) {
        throw new TypeError("Contract verdict exception expiry disagrees with its coordinate findings.");
      }
    }
  }
  const derivedVerdict = runError
    ? "error"
    : findings.every((finding) => passingKinds.has(finding.kind)) ? "passed" : "failed";
  if (verdict.complete === runError || verdict.verdict !== derivedVerdict) {
    throw new TypeError("Contract verdict status disagrees with its findings and completeness.");
  }
  return Object.freeze({
    contractDigest,
    findings: Object.freeze(findings),
    verdict: verdict.verdict,
  });
}

function findingCounts(findings) {
  const kinds = Object.fromEntries(findingOrder.map((kind) => [kind, 0]));
  let matched = 0;
  for (const finding of findings) {
    kinds[finding.kind] += 1;
    if (passingKinds.has(finding.kind)) matched += 1;
  }
  return Object.freeze({
    blocking: findings.length - matched,
    kinds: Object.freeze(kinds),
    matched,
    total: findings.length,
  });
}

function utf8Prefix(value, maximumBytes) {
  let result = "";
  let bytes = 0;
  for (const character of value) {
    const size = Buffer.byteLength(character);
    if (bytes + size > maximumBytes) break;
    result += character;
    bytes += size;
  }
  return result;
}

export function boundedSummary(value, maximumBytes = MAXIMUM_SUMMARY_BYTES) {
  if (Buffer.byteLength(value) <= maximumBytes) return value;
  const suffix = "\n\nSummary truncated at the deterministic 512 KiB safety boundary. The complete result remains in `.uiwitness/contract-verdict.json`.\n";
  return `${utf8Prefix(value, maximumBytes - Buffer.byteLength(suffix))}${suffix}`;
}

function findingDetail(finding) {
  const coordinate = finding.id ?? "run";
  const actual = record(finding.actual ?? {}, "Finding actual outcome");
  const codes = Array.isArray(actual.failureCodes) ? actual.failureCodes.join(", ") : actual.status;
  return `${markdown(coordinate)} — ${markdown(finding.kind)}${codes === undefined ? "" : ` — ${markdown(codes)}`}`;
}

export function buildSummary(parsed, options = {}) {
  const counts = findingCounts(parsed.findings);
  const detail = parsed.findings
    .slice(0, options.maximumFindings ?? MAXIMUM_SUMMARY_FINDINGS);
  const detailedTotal = parsed.findings.length;
  const lines = [
    "# UIWitness Contract Guard",
    "",
    `**Verdict:** ${markdown(parsed.verdict.toUpperCase())}`,
    "",
    `**Findings:** ${counts.total} total · ${counts.matched} matched · ${counts.blocking} blocking`,
    "",
    "## Totals by kind",
    "",
    "| Kind | Count |",
    "| --- | ---: |",
    ...findingOrder.filter((kind) => counts.kinds[kind] > 0).map((kind) => `| ${kind} | ${counts.kinds[kind]} |`),
    "",
    "## Finding details",
    "",
    ...(detail.length === 0 ? ["None."] : detail.map((finding, index) => `${index + 1}. ${findingDetail(finding)}`)),
  ];
  if (detailedTotal > detail.length) {
    lines.push("", `${detailedTotal - detail.length} additional canonical finding(s) omitted from this bounded summary.`);
  }
  lines.push(
    "",
    `Complete machine verdict: \`${DEFAULT_VERDICT_PATH}\``,
    `Offline report: \`${DEFAULT_REPORT_PATH}\``,
    "",
  );
  return boundedSummary(lines.join("\n"));
}

export function annotationCommands(parsed, cap) {
  return Object.freeze(parsed.findings
    .filter((finding) => !passingKinds.has(finding.kind))
    .slice(0, cap)
    .map((finding) => {
      const title = `UIWitness ${finding.kind}`;
      const message = `${finding.id ?? "run"}: ${finding.kind}`;
      return `::error title=${workflowProperty(title)}::${workflowMessage(message)}`;
    }));
}

function outputValues(parsed, exitCode) {
  const counts = parsed === undefined
    ? { blocking: 0, matched: 0, total: 0 }
    : findingCounts(parsed.findings);
  return Object.freeze({
    "blocking-count": String(counts.blocking),
    "contract-digest": parsed?.contractDigest ?? "",
    "exit-class": exitCode === 0 ? "success" : exitCode === 1 ? "contract-failure" : "setup-error",
    "exit-code": String(exitCode),
    "finding-count": String(counts.total),
    "matched-count": String(counts.matched),
    "report-path": parsed === undefined ? "" : DEFAULT_REPORT_PATH,
    verdict: parsed?.verdict ?? "error",
  });
}

async function writeOutputs(target, values) {
  if (target === undefined || target.length === 0) return;
  const contents = Object.entries(values).map(([key, value]) => `${key}=${value}\n`).join("");
  await appendFile(target, contents, "utf8");
}

async function execute(command, args, options) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.environment,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdout = [];
    const stderr = [];
    child.stdout.on("data", (chunk) => stdout.push(chunk));
    child.stderr.on("data", (chunk) => stderr.push(chunk));
    child.once("error", rejectPromise);
    child.once("close", (code, signal) => resolvePromise({
      code: code ?? 2,
      signal,
      stderr: Buffer.concat(stderr).toString("utf8"),
      stdout: Buffer.concat(stdout).toString("utf8"),
    }));
  });
}

async function localCli(root, expectedVersion) {
  const candidate = path.join(root, "node_modules", "uiwitness", "dist", "bin.js");
  try {
    await access(candidate, constants.R_OK);
  } catch {
    throw new Error(`Project-local UIWitness CLI not found. Run npm install --save-dev --save-exact uiwitness@${expectedVersion}, commit the refreshed lockfile, and run the package-manager install step first.`);
  }
  return candidate;
}

async function appendSummary(environment, contents, writeLog) {
  const target = environment.GITHUB_STEP_SUMMARY;
  if (target === undefined || target.length === 0) return;
  try {
    await appendFile(target, contents, "utf8");
  } catch {
    writeLog(`::warning title=UIWitness summary::${workflowMessage("Could not write the bounded GitHub step summary. The CLI verdict remains authoritative.")}\n`);
  }
}

export async function runAction({
  actionRoot,
  cwd = process.cwd(),
  environment = process.env,
  executeCommand = execute,
  writeLog = (message) => process.stdout.write(message),
} = {}) {
  let parsed;
  let exitCode;
  try {
    const inputs = parseActionInputs(environment);
    const expectedVersion = normalizeActionVersion(await readFile(path.join(actionRoot, "VERSION"), "utf8"));
    const cli = await localCli(cwd, expectedVersion);
    const versionResult = await executeCommand(process.execPath, [cli, "--version"], { cwd, environment });
    const actualVersion = versionResult.stdout.trim();
    if (versionResult.code !== 0 || actualVersion !== expectedVersion) {
      throw new Error(`UIWitness Action ${expectedVersion} requires project-local uiwitness@${expectedVersion}. Run npm install --save-dev --save-exact uiwitness@${expectedVersion} and commit the refreshed lockfile before running the guard.`);
    }
    const invocationVerdictPath = `.uiwitness/action-verdicts/${randomUUID()}.json`;
    const args = ["guard"];
    if (inputs.config !== undefined) args.push("--config", inputs.config);
    if (inputs.contract !== undefined) args.push("--contract", inputs.contract);
    args.push("--json", invocationVerdictPath);
    const result = await executeCommand(process.execPath, [cli, ...args], { cwd, environment });
    if (result.stdout.length > 0) writeLog(`${safeLog(result.stdout)}\n`);
    if (result.stderr.length > 0) writeLog(`${safeLog(result.stderr)}\n`);
    exitCode = result.code === 0 || result.code === 1 ? result.code : 2;
    if (exitCode !== 2) {
      const candidate = parseMachineVerdict(JSON.parse(await readFile(path.join(cwd, invocationVerdictPath), "utf8")));
      const verdictExitCode = candidate.verdict === "passed"
        ? 0
        : candidate.verdict === "failed" ? 1 : 2;
      if (exitCode !== verdictExitCode) {
        throw new Error("The project-local CLI exit code disagrees with its machine verdict.");
      }
      parsed = candidate;
      await appendSummary(environment, buildSummary(parsed), writeLog);
      for (const command of annotationCommands(parsed, inputs.annotationCap)) writeLog(`${command}\n`);
    } else {
      await appendSummary(environment, boundedSummary("# UIWitness Contract Guard\n\n**Verdict:** ERROR\n\nThe project-local CLI could not produce a complete contract verdict. See the prefixed CLI output above.\n"), writeLog);
    }
  } catch (error) {
    exitCode = 2;
    parsed = undefined;
    const message = error instanceof Error ? error.message : "UIWitness Action failed unexpectedly.";
    writeLog(`::error title=UIWitness setup error::${workflowMessage(message)}\n`);
    await appendSummary(environment, boundedSummary(`# UIWitness Contract Guard\n\n**Verdict:** ERROR\n\n${markdown(message)}\n`), writeLog);
  }
  await writeOutputs(environment.GITHUB_OUTPUT, outputValues(parsed, exitCode));
  return exitCode;
}

export function finalizeAction(value) {
  return value === "0" ? 0 : 1;
}

async function main() {
  const command = process.argv[2];
  if (command === "run") {
    process.exitCode = await runAction({
      actionRoot: process.env.GITHUB_ACTION_PATH ?? path.resolve(fileURLToPath(new URL("../../../", import.meta.url))),
    });
    return;
  }
  if (command === "finalize") {
    process.exitCode = finalizeAction(process.env.UIWITNESS_GUARD_EXIT_CODE);
    return;
  }
  process.stderr.write("UIWitness Action adapter requires run or finalize.\n");
  process.exitCode = 2;
}

if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
