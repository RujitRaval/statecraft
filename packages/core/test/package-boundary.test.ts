import { execFile } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const require = createRequire(import.meta.url);

interface PackageManifest {
  exports?: {
    "."?: {
      import?: string;
      types?: string;
    };
  };
  name?: string;
  private?: boolean;
  type?: string;
}

describe("uiwitness-core package boundary", () => {
  it("defines a publishable ESM build with deterministic dist paths", async () => {
    const manifestUrl = new URL("../package.json", import.meta.url);
    const contents = await readFile(manifestUrl, "utf8");
    const manifest = JSON.parse(contents) as PackageManifest;

    expect(manifest).toMatchObject({
      name: "uiwitness-core",
      type: "module",
      exports: {
        ".": {
          import: "./dist/index.js",
          types: "./dist/index.d.ts",
        },
      },
    });
    expect(manifest.private).toBeUndefined();

    const importPath = manifest.exports?.["."]?.import;
    const typesPath = manifest.exports?.["."]?.types;
    expect(importPath).toBeDefined();
    expect(typesPath).toBeDefined();

    const packageRoot = new URL("../", import.meta.url);
    const importUrl = new URL(importPath ?? "", packageRoot);
    const typesUrl = new URL(typesPath ?? "", packageRoot);
    await expect(access(typesUrl)).resolves.toBeUndefined();
    const builtModule = await import(importUrl.href);
    expect(Object.keys(builtModule).sort()).toEqual([
      "CANONICAL_JSON_ALGORITHM",
      "COMMITTED_GENERATION_SCHEMA_VERSION",
      "CONTRACT_CONFIG_DIGEST_ALGORITHM",
      "CONTRACT_DIGEST_ALGORITHM",
      "CONTRACT_FAILURE_CODES",
      "CONTRACT_FINDING_KINDS",
      "CONTRACT_FINDING_PRECEDENCE",
      "CONTRACT_METADATA_SCHEMA_VERSION",
      "CONTRACT_PROPOSAL_OPERATIONS",
      "CONTRACT_PROPOSAL_SCHEMA_VERSION",
      "CONTRACT_SCHEMA_VERSION",
      "CONTRACT_SOURCE_SCHEMA_VERSION",
      "CanonicalJsonError",
      "ConfigValidationError",
      "ContractProposalValidationError",
      "ContractValidationError",
      "GENERATION_ARTIFACT_ROLES",
      "GENERATION_MANIFEST_SCHEMA_VERSION",
      "GenerationValidationError",
      "REPORT_SCHEMA_VERSION",
      "ReportValidationError",
      "ResultValidationError",
      "UIWitnessError",
      "applyContractProposal",
      "calculateCoverage",
      "canonicalJsonDigest",
      "canonicalizeContract",
      "canonicalizeJson",
      "compareContract",
      "contractConfigDigest",
      "contractDigest",
      "contractProposalDigest",
      "contractProposalSourceDigest",
      "contractVerdictStatus",
      "createContractProposal",
      "createContractProposalSource",
      "defineConfig",
      "emptyContractProposalMetadata",
      "expandMatrix",
      "generationManifestDigest",
      "parseCommittedGeneration",
      "parseConfig",
      "parseContract",
      "parseContractProposal",
      "parseContractProposalMetadata",
      "parseContractProposalSource",
      "parseExecutionResult",
      "parseGenerationManifest",
      "parseReport",
      "screenshotArtifactPath",
      "serializeCommittedGeneration",
      "serializeContractProposal",
      "serializeContractProposalMetadata",
      "serializeContractProposalSource",
      "serializeGenerationManifest",
      "serializeReport",
      "withContractProposalAnnotation",
    ]);
  });

  it("compiles the documented public API through the package export", async () => {
    const typeScriptCli = require.resolve("typescript/bin/tsc");
    const typeContractConfig = fileURLToPath(
      new URL("../test-d/tsconfig.json", import.meta.url),
    );

    await expect(
      execFileAsync(process.execPath, [typeScriptCli, "-p", typeContractConfig]),
    ).resolves.toMatchObject({ stderr: "", stdout: "" });
  });
});
