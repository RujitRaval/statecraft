import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const nextBinary = fileURLToPath(import.meta.resolve("next/dist/bin/next"));
const child = spawn(process.execPath, [nextBinary, ...process.argv.slice(2)], {
  env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
  stdio: "inherit",
});

child.once("error", (error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

child.once("exit", (code) => {
  process.exitCode = code ?? 1;
});
