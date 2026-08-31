import { constants } from "node:fs";
import { access, open, realpath, stat } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { parseConfig, type UIWitnessConfig } from "uiwitness-core";

/** Config filenames recognized during default project-root discovery. */
export const DEFAULT_CONFIG_FILENAMES: readonly string[] = Object.freeze([
  "uiwitness.config.ts",
  "uiwitness.config.mts",
  "uiwitness.config.cts",
  "uiwitness.config.js",
  "uiwitness.config.mjs",
  "uiwitness.config.cjs",
]);

/** Inputs shared by config discovery and loading. */
export interface ConfigDiscoveryOptions {
  /** Explicit config path, resolved relative to `cwd` when it is not absolute. */
  readonly configPath?: string | undefined;
  /** Project directory to search. Defaults to the current working directory. */
  readonly cwd?: string | undefined;
}

/** Stable categories for configuration discovery failures. */
export type ConfigDiscoveryErrorCode =
  | "CONFIG_AMBIGUOUS"
  | "CONFIG_NOT_FOUND"
  | "CONFIG_PATH_INVALID"
  | "CONFIG_ROOT_INVALID";

interface ConfigDiscoveryErrorOptions {
  readonly candidates?: readonly string[] | undefined;
  readonly configPath?: string | undefined;
}

/** An expected, classifiable failure while locating a project config. */
export class ConfigDiscoveryError extends Error {
  readonly candidates: readonly string[];
  readonly code: ConfigDiscoveryErrorCode;
  readonly configPath: string | undefined;

  constructor(
    code: ConfigDiscoveryErrorCode,
    message: string,
    options: ConfigDiscoveryErrorOptions = {},
  ) {
    super(message);
    this.name = "ConfigDiscoveryError";
    this.code = code;
    this.configPath = options.configPath;
    this.candidates = Object.freeze([...(options.candidates ?? [])]);
  }
}

/** Stable categories for configuration module loading failures. */
export type ConfigLoadErrorCode =
  | "CONFIG_DEFAULT_EXPORT_MISSING"
  | "CONFIG_IMPORT_FAILED";

/** A classifiable failure while executing a trusted local config module. */
export class ConfigLoadError extends Error {
  readonly code: ConfigLoadErrorCode;
  readonly configPath: string;

  constructor(
    code: ConfigLoadErrorCode,
    message: string,
    configPath: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "ConfigLoadError";
    this.code = code;
    this.configPath = configPath;
  }
}

/** A validated UIWitness config paired with its canonical source path. */
export interface LoadedConfig {
  readonly config: UIWitnessConfig;
  readonly path: string;
}

async function canonicalDirectory(cwd: string | undefined): Promise<string> {
  const directory = resolve(cwd ?? process.cwd());

  try {
    const metadata = await stat(directory);
    if (!metadata.isDirectory()) {
      throw new ConfigDiscoveryError(
        "CONFIG_ROOT_INVALID",
        `Config search root is not a directory: ${directory}`,
        { configPath: directory },
      );
    }
    await access(directory, constants.R_OK | constants.X_OK);
    return await realpath(directory);
  } catch (error: unknown) {
    if (error instanceof ConfigDiscoveryError) {
      throw error;
    }
    throw new ConfigDiscoveryError(
      "CONFIG_ROOT_INVALID",
      `Config search root does not exist or cannot be read: ${directory}`,
      { configPath: directory },
    );
  }
}

async function canonicalRegularFile(
  candidate: string,
  messagePrefix: string,
): Promise<string> {
  try {
    const metadata = await stat(candidate);
    if (!metadata.isFile()) {
      throw new ConfigDiscoveryError(
        "CONFIG_PATH_INVALID",
        `${messagePrefix} is not a regular file: ${candidate}`,
        { configPath: candidate },
      );
    }
    const canonicalPath = await realpath(candidate);
    const handle = await open(canonicalPath, "r");
    await handle.close();
    return canonicalPath;
  } catch (error: unknown) {
    if (error instanceof ConfigDiscoveryError) {
      throw error;
    }
    throw new ConfigDiscoveryError(
      "CONFIG_PATH_INVALID",
      `${messagePrefix} does not exist or cannot be read: ${candidate}`,
      { configPath: candidate },
    );
  }
}

/**
 * Finds a UIWitness config without walking parent directories or choosing
 * silently between multiple supported filenames.
 */
export async function discoverConfig(
  options: ConfigDiscoveryOptions = {},
): Promise<string> {
  if (
    options.configPath !== undefined &&
    isAbsolute(options.configPath)
  ) {
    return canonicalRegularFile(
      resolve(options.configPath),
      "Explicit config path",
    );
  }

  const lexicalRoot = resolve(options.cwd ?? process.cwd());
  const root = await canonicalDirectory(lexicalRoot);

  if (options.configPath !== undefined) {
    return canonicalRegularFile(
      resolve(lexicalRoot, options.configPath),
      "Explicit config path",
    );
  }

  const discovered = new Set<string>();
  for (const filename of DEFAULT_CONFIG_FILENAMES) {
    const candidate = resolve(root, filename);
    try {
      const metadata = await stat(candidate);
      if (!metadata.isFile()) {
        throw new ConfigDiscoveryError(
          "CONFIG_PATH_INVALID",
          `Discovered config path is not a regular file: ${candidate}`,
          { configPath: candidate },
        );
      }
      const canonicalPath = await realpath(candidate);
      const handle = await open(canonicalPath, "r");
      await handle.close();
      discovered.add(canonicalPath);
    } catch (error: unknown) {
      if (error instanceof ConfigDiscoveryError) {
        throw error;
      }
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw new ConfigDiscoveryError(
          "CONFIG_PATH_INVALID",
          `Config candidate cannot be read: ${candidate}`,
          { configPath: candidate },
        );
      }
    }
  }

  const canonicalPaths = [...discovered].sort();
  if (canonicalPaths.length === 0) {
    throw new ConfigDiscoveryError(
      "CONFIG_NOT_FOUND",
      `No UIWitness config found in ${root}.`,
      {
        candidates: DEFAULT_CONFIG_FILENAMES.map((filename) =>
          resolve(root, filename),
        ),
      },
    );
  }
  if (canonicalPaths.length > 1) {
    throw new ConfigDiscoveryError(
      "CONFIG_AMBIGUOUS",
      `Multiple UIWitness configs found in ${root}. Pass an explicit config path.`,
      { candidates: canonicalPaths },
    );
  }

  return canonicalPaths[0]!;
}

/** Locates, executes, and validates a trusted local UIWitness config module. */
export async function loadConfig(
  options: ConfigDiscoveryOptions = {},
): Promise<LoadedConfig> {
  const configPath = await discoverConfig(options);
  let configModule: Record<string, unknown>;

  try {
    configModule = (await import(pathToFileURL(configPath).href)) as Record<
      string,
      unknown
    >;
  } catch (cause: unknown) {
    throw new ConfigLoadError(
      "CONFIG_IMPORT_FAILED",
      `Failed to import UIWitness config: ${configPath}`,
      configPath,
      { cause },
    );
  }

  if (!Object.prototype.hasOwnProperty.call(configModule, "default")) {
    throw new ConfigLoadError(
      "CONFIG_DEFAULT_EXPORT_MISSING",
      `UIWitness config must have a default export: ${configPath}`,
      configPath,
    );
  }

  return Object.freeze({
    config: parseConfig(configModule["default"]),
    path: configPath,
  });
}
