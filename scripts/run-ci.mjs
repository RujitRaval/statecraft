import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const requiredScripts = ["lint", "typecheck", "test", "build"];

function defaultRunCommand(script, root) {
  const { command, args } = corepackInvocation(process.platform, script);
  return spawnSync(command, args, {
    cwd: root,
    stdio: "inherit",
  });
}

export function corepackInvocation(platform, script, comspec = "cmd.exe") {
  if (!requiredScripts.includes(script)) {
    throw new Error(`Unsupported repository check: ${script}`);
  }

  return platform === "win32"
    ? { command: comspec, args: ["/d", "/s", "/c", `corepack pnpm run ${script}`] }
    : { command: "corepack", args: ["pnpm", "run", script] };
}

export async function runCi({
  root = process.cwd(),
  runCommand = defaultRunCommand,
  log = console.log,
} = {}) {
  let packageJson;

  try {
    packageJson = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") {
      log("No package.json yet; implementation checks activate in Phase 1.");
      return { scriptsRun: [] };
    }
    throw error;
  }

  const missingScripts = requiredScripts.filter((script) => !packageJson.scripts?.[script]);
  if (missingScripts.length > 0) {
    throw new Error(`Missing required package scripts: ${missingScripts.join(", ")}`);
  }

  const scriptsRun = [];
  for (const script of requiredScripts) {
    const result = runCommand(script, root);
    if (result.error) {
      throw result.error;
    }
    if (result.status !== 0) {
      throw new Error(`Repository check failed: ${script} exited with ${result.status ?? 1}`);
    }
    scriptsRun.push(script);
  }

  log("All repository checks passed.");
  return { scriptsRun };
}

async function main() {
  try {
    await runCi();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
