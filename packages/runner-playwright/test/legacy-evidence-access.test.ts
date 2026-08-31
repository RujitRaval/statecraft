import { tmpdir } from "node:os";
import { join, sep } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

const sentinel = vi.hoisted(() => ({
  active: false,
  legacyCalls: [] as string[],
}));
const legacyEvidenceRoot = `.${["state", "craft"].join("")}`;

vi.mock("node:fs/promises", async (importOriginal) => {
  const original = await importOriginal<typeof import("node:fs/promises")>();
  const mocked = { ...original } as Record<string, unknown>;
  for (const name of [
    "access",
    "chmod",
    "lstat",
    "mkdir",
    "mkdtemp",
    "open",
    "readFile",
    "readdir",
    "realpath",
    "rename",
    "rm",
    "stat",
    "symlink",
    "writeFile",
  ] as const) {
    const operation = original[name] as (...arguments_: unknown[]) => unknown;
    mocked[name] = (...arguments_: unknown[]) => {
      if (sentinel.active) {
        for (const argument of arguments_) {
          const value =
            typeof argument === "string"
              ? argument
              : argument instanceof URL
                ? argument.pathname
                : undefined;
          if (
            value === legacyEvidenceRoot ||
            value?.endsWith(`${sep}${legacyEvidenceRoot}`) === true ||
            value?.includes(`${sep}${legacyEvidenceRoot}${sep}`) === true
          ) {
            sentinel.legacyCalls.push(`${name}:${value}`);
          }
        }
      }
      return Reflect.apply(operation, original, arguments_);
    };
  }
  return mocked;
});

import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";

import {
  acquirePersistenceLock,
  releasePersistenceLock,
  runPersistedScenarioCells,
} from "../src/persistence.js";

const projects: string[] = [];

async function projectFixture(): Promise<{
  readonly legacyArtifact: string;
  readonly legacyReport: string;
  readonly root: string;
}> {
  const root = await mkdtemp(join(tmpdir(), "uiwitness-legacy-sentinel-"));
  projects.push(root);
  const legacyRoot = join(root, legacyEvidenceRoot);
  const legacyArtifact = join(
    legacyRoot,
    "artifacts/dashboard/success/desktop-light.png",
  );
  const legacyReport = join(
    legacyRoot,
    "report",
    `${["state", "craft"].join("")}.json`,
  );
  await mkdir(join(legacyRoot, "artifacts/dashboard/success"), {
    recursive: true,
  });
  await mkdir(join(legacyRoot, "report"), { recursive: true });
  await writeFile(legacyArtifact, Uint8Array.of(137, 80, 78, 71));
  await writeFile(legacyReport, "legacy-report\n", "utf8");
  return { legacyArtifact, legacyReport, root };
}

async function expectLegacyBytesUnchanged(
  fixture: Awaited<ReturnType<typeof projectFixture>>,
): Promise<void> {
  await expect(readFile(fixture.legacyArtifact)).resolves.toEqual(
    Buffer.from([137, 80, 78, 71]),
  );
  await expect(readFile(fixture.legacyReport, "utf8")).resolves.toBe(
    "legacy-report\n",
  );
}

afterEach(async () => {
  sentinel.active = false;
  sentinel.legacyCalls.length = 0;
  await Promise.all(
    projects.splice(0).map(async (project) => {
      await chmod(join(project, legacyEvidenceRoot), 0o700).catch(
        () => undefined,
      );
      await rm(project, { force: true, recursive: true });
    }),
  );
});

describe("legacy evidence filesystem isolation", () => {
  it.skipIf(process.platform === "win32")(
    "records zero legacy accesses through success and failed publication",
    async () => {
      const success = await projectFixture();
      await chmod(join(success.root, legacyEvidenceRoot), 0o000);
      sentinel.active = true;

      await runPersistedScenarioCells([], {
        baseURL: "https://uiwitness.invalid/",
        generatedAt: new Date("2026-08-31T18:00:00.000Z"),
        projectDirectory: success.root,
      });

      sentinel.active = false;
      await chmod(join(success.root, legacyEvidenceRoot), 0o700);
      await expectLegacyBytesUnchanged(success);

      const failed = await projectFixture();
      const outside = await mkdtemp(join(tmpdir(), "uiwitness-outside-"));
      projects.push(outside);
      await mkdir(join(failed.root, ".uiwitness"));
      await symlink(outside, join(failed.root, ".uiwitness", "artifacts"));
      await chmod(join(failed.root, legacyEvidenceRoot), 0o000);
      sentinel.active = true;

      await expect(
        runPersistedScenarioCells([], {
          baseURL: "https://uiwitness.invalid/",
          projectDirectory: failed.root,
        }),
      ).rejects.toThrow(
        ".uiwitness/artifacts must be a real directory, not a symbolic link.",
      );

      sentinel.active = false;
      await chmod(join(failed.root, legacyEvidenceRoot), 0o700);
      await expectLegacyBytesUnchanged(failed);
      expect(sentinel.legacyCalls).toEqual([]);
    },
  );

  it.skipIf(process.platform === "win32")(
    "records zero legacy accesses while recovering an interrupted capture",
    async () => {
      const fixture = await projectFixture();
      const evidenceRoot = join(fixture.root, ".uiwitness");
      const lock = join(evidenceRoot, ".runner-persistence-lock");
      await mkdir(lock, { recursive: true });
      await writeFile(
        join(lock, "owner.json"),
        `${JSON.stringify({
          pid: 2_147_483_647,
          schemaVersion: 1,
          token: "interrupted-capture",
        })}\n`,
        "utf8",
      );
      await mkdir(join(evidenceRoot, ".runner-persistence-stage-abandoned"));
      await chmod(join(fixture.root, legacyEvidenceRoot), 0o000);
      sentinel.active = true;

      const replacement = await acquirePersistenceLock(fixture.root);
      await releasePersistenceLock(replacement);

      sentinel.active = false;
      await chmod(join(fixture.root, legacyEvidenceRoot), 0o700);
      await expectLegacyBytesUnchanged(fixture);
      expect(sentinel.legacyCalls).toEqual([]);
    },
  );
});
