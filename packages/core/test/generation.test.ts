import { describe, expect, it } from "vitest";

import {
  GenerationValidationError,
  generationManifestDigest,
  parseCommittedGeneration,
  parseGenerationManifest,
  serializeCommittedGeneration,
  serializeGenerationManifest,
  type UIWitnessGenerationManifest,
} from "../src/index.js";

const reportDigest = `sha256:${"a".repeat(64)}` as const;
const htmlDigest = `sha256:${"b".repeat(64)}` as const;
const sourceDigest = `sha256:${"c".repeat(64)}` as const;

function manifest(): UIWitnessGenerationManifest {
  return {
    artifacts: [
      {
        bytes: 12,
        digest: htmlDigest,
        mutable: false,
        path: ".uiwitness/report/index.html",
        role: "report-html",
      },
      {
        bytes: 10,
        digest: reportDigest,
        mutable: false,
        path: ".uiwitness/report/uiwitness.json",
        role: "report-json",
      },
    ],
    complete: true,
    reportDigest,
    runDigest: null,
    schemaVersion: 1,
    sourceGenerationDigests: [sourceDigest],
    toolVersion: "0.26.4",
  };
}

describe("generation manifests", () => {
  it("round-trips canonical complete manifests and committed markers", () => {
    const parsed = parseGenerationManifest(serializeGenerationManifest(manifest()));
    const digest = generationManifestDigest(parsed);
    const marker = parseCommittedGeneration(serializeCommittedGeneration({
      manifestDigest: digest,
      manifestPath: `.uiwitness/generations/${digest.slice(7)}.manifest.json`,
      schemaVersion: 1,
      sourceGenerationDigests: [sourceDigest],
    }));

    expect(parsed).toEqual(manifest());
    expect(marker.manifestDigest).toBe(digest);
    expect(Object.isFrozen(parsed.artifacts)).toBe(true);
  });

  it("rejects noncanonical, duplicate, unsafe, or incomplete generation data", () => {
    expect(() => parseGenerationManifest(JSON.stringify(manifest(), null, 2)))
      .toThrow(GenerationValidationError);
    expect(() => parseGenerationManifest(serializeGenerationManifest({
      ...manifest(),
      artifacts: [manifest().artifacts[0]!, manifest().artifacts[0]!],
    }))).toThrow(GenerationValidationError);
    expect(() => parseGenerationManifest(serializeGenerationManifest({
      ...manifest(),
      artifacts: manifest().artifacts.map((artifact, index) =>
        index === 0 ? { ...artifact, path: "../escape" } : artifact
      ),
    }))).toThrow(GenerationValidationError);
    expect(() => parseCommittedGeneration(serializeCommittedGeneration({
      manifestDigest: reportDigest,
      manifestPath: ".uiwitness/generations/wrong.manifest.json",
      schemaVersion: 1,
      sourceGenerationDigests: [],
    }))).toThrow(GenerationValidationError);
  });

  it("accepts 1,024-byte paths and rejects longer generation paths", () => {
    const prefix = ".uiwitness/";
    const atLimit = `${prefix}${"a".repeat(1_024 - prefix.length)}`;
    const artifacts = manifest().artifacts.map((artifact, index) =>
      index === 0 ? { ...artifact, path: atLimit } : artifact
    );
    expect(parseGenerationManifest(serializeGenerationManifest({
      ...manifest(),
      artifacts,
    })).artifacts[0]?.path).toBe(atLimit);
    expect(() => parseGenerationManifest(serializeGenerationManifest({
      ...manifest(),
      artifacts: artifacts.map((artifact, index) =>
        index === 0 ? { ...artifact, path: `${atLimit}a` } : artifact
      ),
    }))).toThrow(GenerationValidationError);
  });
});
