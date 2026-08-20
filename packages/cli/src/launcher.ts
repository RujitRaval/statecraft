import { spawn } from "node:child_process";
import { win32 } from "node:path";

interface ReportOpenCommand {
  readonly args: readonly string[];
  readonly file: string;
}

interface ReportSpawnOptions {
  readonly detached: true;
  readonly shell: false;
  readonly stdio: "ignore";
  readonly windowsHide: true;
}

interface SpawnedReportProcess {
  once(event: "error", listener: (error: Error) => void): this;
  once(event: "spawn", listener: () => void): this;
  unref(): void;
}

type SpawnReportProcess = (
  file: string,
  args: readonly string[],
  options: ReportSpawnOptions,
) => SpawnedReportProcess;

const spawnReportProcess: SpawnReportProcess = (file, args, options) =>
  spawn(file, args, options);

/** Maps a report path to a shell-free platform launcher invocation. */
export function reportOpenCommand(
  platform: string,
  reportPath: string,
  windowsDirectory: string = process.env["SystemRoot"] ?? "C:\\Windows",
): ReportOpenCommand {
  if (platform === "darwin") {
    return Object.freeze({
      args: Object.freeze([reportPath]),
      file: "/usr/bin/open",
    });
  }
  if (platform === "win32") {
    const systemDirectory = win32.isAbsolute(windowsDirectory)
      ? windowsDirectory
      : "C:\\Windows";
    return Object.freeze({
      args: Object.freeze([reportPath]),
      file: win32.join(systemDirectory, "explorer.exe"),
    });
  }
  return Object.freeze({
    args: Object.freeze([reportPath]),
    file: platform === "freebsd" ? "/usr/local/bin/xdg-open" : "/usr/bin/xdg-open",
  });
}

/** Resolves once the OS accepts the detached launcher process. */
export async function launchReportWithSpawn(
  reportPath: string,
  platform: string,
  spawnProcess: SpawnReportProcess,
): Promise<void> {
  const command = reportOpenCommand(platform, reportPath);

  await new Promise<void>((resolve, reject) => {
    let child: SpawnedReportProcess;
    try {
      child = spawnProcess(command.file, command.args, {
        detached: true,
        shell: false,
        stdio: "ignore",
        windowsHide: true,
      });
    } catch (error: unknown) {
      reject(error instanceof Error ? error : new Error("Launcher spawn failed."));
      return;
    }
    child.once("error", reject);
    child.once("spawn", () => {
      child.unref();
      resolve();
    });
  });
}

/** Hands a report path to the platform launcher without waiting for GUI exit. */
export async function launchReport(reportPath: string): Promise<void> {
  return launchReportWithSpawn(reportPath, process.platform, spawnReportProcess);
}
