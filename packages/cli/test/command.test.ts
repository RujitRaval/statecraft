import {
  lstat,
  mkdtemp,
  readFile,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { runCli } from "../src/command.js";

const temporaryProjects: string[] = [];

async function temporaryProject(): Promise<string> {
  const project = await realpath(
    await mkdtemp(join(tmpdir(), "statecraft-cli-command-")),
  );
  temporaryProjects.push(project);
  return project;
}

afterEach(async () => {
  await Promise.all(
    temporaryProjects.splice(0).map((project) =>
      rm(project, { force: true, recursive: true }),
    ),
  );
});

function outputCapture(): {
  readonly messages: string[];
  readonly write: (message: string) => void;
} {
  const messages: string[] = [];
  return {
    messages,
    write(message: string): void {
      messages.push(message);
    },
  };
}

describe("runCli", () => {
  it.each(["--help", "-h", "help"])(
    "prints help for %s without touching the filesystem",
    async (argument) => {
    const project = await temporaryProject();
    const stdout = outputCapture();
    const stderr = outputCapture();

    await expect(
      runCli({
        args: [argument],
        cwd: project,
        stderr: stderr.write,
        stdout: stdout.write,
      }),
    ).resolves.toBe(0);
    expect(stdout.messages.join("")).toContain("statecraft init");
    expect(stderr.messages).toEqual([]);
    await expect(
      lstat(join(project, "statecraft.config.ts")),
    ).rejects.toMatchObject({ code: "ENOENT" });
    },
  );

  it("returns setup exit code 2 for missing and unsupported commands", async () => {
    const stderr = outputCapture();

    await expect(runCli({ args: [], stderr: stderr.write })).resolves.toBe(2);
    await expect(
      runCli({ args: ["scan"], stderr: stderr.write }),
    ).resolves.toBe(2);
    expect(stderr.messages.join("")).toContain("Missing command.");
    expect(stderr.messages.join("")).toContain("Unknown command: scan");
  });

  it("rejects init arguments before touching the filesystem", async () => {
    const project = await temporaryProject();
    const stderr = outputCapture();

    await expect(
      runCli({
        args: ["init", "--force"],
        cwd: project,
        stderr: stderr.write,
      }),
    ).resolves.toBe(2);
    expect(stderr.messages.join("")).toContain(
      "The init command does not accept arguments: --force",
    );
    await expect(
      lstat(join(project, "statecraft.config.ts")),
    ).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("initializes a project and prints exact next steps", async () => {
    const project = await temporaryProject();
    const stdout = outputCapture();
    const stderr = outputCapture();

    await expect(
      runCli({
        args: ["init"],
        cwd: project,
        stderr: stderr.write,
        stdout: stdout.write,
      }),
    ).resolves.toBe(0);
    expect(stdout.messages.join("")).toBe(`Statecraft initialized.

Created:
  statecraft.config.ts
  statecraft/scenarios/home/success.ts

Next:
  1. Update statecraft.config.ts for your app.
  2. Add scenario hooks in statecraft/scenarios/home/success.ts.
  3. Run statecraft scan.
`);
    expect(stderr.messages).toEqual([]);
  });

  it("reports conflicts without replacing existing content", async () => {
    const project = await temporaryProject();
    const configPath = join(project, "statecraft.config.ts");
    const stderr = outputCapture();
    await writeFile(configPath, "keep", "utf8");

    await expect(
      runCli({
        args: ["init"],
        cwd: project,
        stderr: stderr.write,
      }),
    ).resolves.toBe(2);
    expect(stderr.messages.join("")).toContain(
      "Statecraft initialization conflicts with existing paths:",
    );
    await expect(readFile(configPath, "utf8")).resolves.toBe("keep");
  });
});
