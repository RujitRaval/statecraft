import { constants } from "node:fs";
import {
  access,
  chmod,
  lstat,
  mkdir,
  open,
  realpath,
  rename,
  rm,
  stat,
} from "node:fs/promises";
import {
  basename,
  dirname,
  isAbsolute,
  relative,
  resolve,
  sep,
} from "node:path";
import { randomUUID } from "node:crypto";

import { GuardError, type GuardErrorCode } from "./guard-errors.js";

function missing(error: unknown): boolean {
  return (error as NodeJS.ErrnoException).code === "ENOENT";
}

function safePathInput(
  inputPath: string,
  code: GuardErrorCode,
  label: string,
): void {
  if ([...inputPath].some((character) => {
    const codePoint = character.codePointAt(0)!;
    return codePoint <= 0x1f || (codePoint >= 0x7f && codePoint <= 0x9f);
  })) {
    throw new GuardError(
      code,
      `${label} cannot contain control characters.`,
      inputPath,
    );
  }
}

export function isContained(root: string, candidate: string): boolean {
  const local = relative(root, candidate);
  return local.length === 0 ||
    (!isAbsolute(local) && local !== ".." && !local.startsWith(`..${sep}`));
}

async function assertRealComponents(
  root: string,
  candidate: string,
  finalKind: "file" | "missing-or-file",
  code: GuardErrorCode,
  label: string,
): Promise<void> {
  if (!isContained(root, candidate) || candidate === root) {
    throw new GuardError(code, `${label} must stay beneath the guard workspace: ${candidate}`, candidate);
  }

  const segments = relative(root, candidate).split(sep);
  let current = root;
  for (const [index, segment] of segments.entries()) {
    current = resolve(current, segment);
    let metadata;
    try {
      metadata = await lstat(current);
    } catch (error: unknown) {
      if (missing(error) && finalKind === "missing-or-file") {
        return;
      }
      throw new GuardError(code, `${label} does not exist or cannot be read: ${candidate}`, candidate, { cause: error });
    }
    if (metadata.isSymbolicLink()) {
      throw new GuardError(code, `${label} cannot pass through a symbolic link: ${current}`, candidate);
    }
    const last = index === segments.length - 1;
    if (last) {
      if (!metadata.isFile()) {
        throw new GuardError(code, `${label} is not a regular file: ${candidate}`, candidate);
      }
      if (metadata.nlink !== 1) {
        throw new GuardError(
          code,
          `${label} cannot be a hard-linked file: ${candidate}`,
          candidate,
        );
      }
    } else if (!metadata.isDirectory()) {
      throw new GuardError(code, `${label} has a non-directory ancestor: ${current}`, candidate);
    }
  }
}

export async function canonicalGuardWorkspace(cwd: string | undefined): Promise<string> {
  const lexical = resolve(cwd ?? process.cwd());
  try {
    const metadata = await stat(lexical);
    if (!metadata.isDirectory()) {
      throw new GuardError(
        "GUARD_WORKSPACE_INVALID",
        `Guard workspace is not a directory: ${lexical}`,
        lexical,
      );
    }
    await access(lexical, constants.R_OK | constants.W_OK | constants.X_OK);
    return await realpath(lexical);
  } catch (error: unknown) {
    if (error instanceof GuardError) {
      throw error;
    }
    throw new GuardError(
      "GUARD_WORKSPACE_INVALID",
      `Guard workspace does not exist or cannot be used: ${lexical}`,
      lexical,
      { cause: error },
    );
  }
}

export async function withContractLock<T>(
  root: string,
  action: () => Promise<T>,
): Promise<T> {
  const lockDirectory = resolve(root, ".uiwitness");
  try {
    await mkdir(lockDirectory, { mode: 0o700 });
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
  }
  const directory = await lstat(lockDirectory);
  if (!directory.isDirectory() || directory.isSymbolicLink()) {
    throw new GuardError(
      "GUARD_CONTRACT_LOCKED",
      "The contract lock directory is not a safe regular directory.",
      lockDirectory,
    );
  }
  const lockPath = resolve(lockDirectory, "contract.lock");
  let handle;
  try {
    handle = await open(lockPath, "wx", 0o600);
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      throw new GuardError(
        "GUARD_CONTRACT_LOCKED",
        "Another UIWitness contract writer is active.",
        lockPath,
      );
    }
    throw error;
  }
  try {
    return await action();
  } finally {
    await handle.close();
    await rm(lockPath, { force: true });
  }
}

export async function containedRegularFile(
  root: string,
  inputPath: string,
  code: GuardErrorCode,
  label: string,
): Promise<string> {
  safePathInput(inputPath, code, label);
  const candidate = resolve(root, inputPath);
  await assertRealComponents(root, candidate, "file", code, label);
  try {
    await access(candidate, constants.R_OK);
  } catch (error: unknown) {
    throw new GuardError(
      code,
      `${label} cannot be read: ${candidate}`,
      candidate,
      { cause: error },
    );
  }
  return candidate;
}

export async function preflightOutputPath(
  root: string,
  inputPath: string,
  exclusive: boolean,
): Promise<string> {
  safePathInput(
    inputPath,
    "GUARD_JSON_PATH_INVALID",
    "Guard JSON path",
  );
  const candidate = resolve(root, inputPath);
  const local = relative(root, candidate).split(sep).join("/");
  if (
    local === ".uiwitness/contract.lock" ||
    local.startsWith(".uiwitness/.runner-")
  ) {
    throw new GuardError(
      "GUARD_JSON_PATH_INVALID",
      `Guard JSON path cannot use a UIWitness control path: ${candidate}`,
      candidate,
    );
  }
  await assertRealComponents(
    root,
    candidate,
    "missing-or-file",
    "GUARD_JSON_PATH_INVALID",
    "Guard JSON path",
  );
  try {
    const metadata = await lstat(candidate);
    if (exclusive) {
      throw new GuardError(
        "GUARD_JSON_EXISTS",
        `Guard JSON path already exists: ${candidate}`,
        candidate,
      );
    }
    if (!metadata.isFile() || metadata.isSymbolicLink()) {
      throw new GuardError(
        "GUARD_JSON_PATH_INVALID",
        `Guard JSON path is not a regular file: ${candidate}`,
        candidate,
      );
    }
  } catch (error: unknown) {
    if (error instanceof GuardError) {
      throw error;
    }
    if (!missing(error)) {
      throw new GuardError(
        "GUARD_JSON_PATH_INVALID",
        `Guard JSON path cannot be inspected: ${candidate}`,
        candidate,
        { cause: error },
      );
    }
  }
  return candidate;
}

async function ensurePrivateDirectories(root: string, destination: string): Promise<void> {
  const segments = relative(root, destination).split(sep).filter(Boolean);
  let current = root;
  for (const segment of segments) {
    current = resolve(current, segment);
    let created = false;
    try {
      await mkdir(current, { mode: 0o700 });
      created = true;
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
        throw error;
      }
    }
    const metadata = await lstat(current);
    if (!metadata.isDirectory() || metadata.isSymbolicLink()) {
      throw new GuardError(
        "GUARD_JSON_PATH_INVALID",
        `Guard JSON path cannot pass through a non-directory or symbolic link: ${current}`,
        destination,
      );
    }
    if (created) {
      await chmod(current, 0o700);
    }
  }
}

export async function writeGuardJson(
  root: string,
  destination: string,
  contents: string,
  exclusive: boolean,
): Promise<void> {
  try {
    await ensurePrivateDirectories(root, dirname(destination));
    await preflightOutputPath(root, destination, exclusive);
    if (exclusive) {
      const handle = await open(destination, "wx", 0o600);
      try {
        await handle.writeFile(contents, "utf8");
        await handle.sync();
      } finally {
        await handle.close();
      }
      return;
    }

    const temporary = resolve(
      dirname(destination),
      `.${basename(destination)}.${randomUUID()}.tmp`,
    );
    let published = false;
    try {
      const handle = await open(temporary, "wx", 0o600);
      try {
        await handle.writeFile(contents, "utf8");
        await handle.sync();
      } finally {
        await handle.close();
      }
      await preflightOutputPath(root, destination, false);
      await rename(temporary, destination);
      published = true;
      await chmod(destination, 0o600);
    } finally {
      if (!published) {
        await rm(temporary, { force: true });
      }
    }
  } catch (error: unknown) {
    if (error instanceof GuardError) {
      throw error;
    }
    throw new GuardError(
      "GUARD_JSON_WRITE_FAILED",
      `Guard JSON could not be written safely: ${destination}`,
      destination,
      { cause: error },
    );
  }
}
