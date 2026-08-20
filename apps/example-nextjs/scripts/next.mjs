import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const nextBinary = fileURLToPath(import.meta.resolve("next/dist/bin/next"));
const child = spawn(process.execPath, [nextBinary, ...process.argv.slice(2)], {
  env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
  stdio: "inherit",
});
const forwardedSignals = ["SIGINT", "SIGHUP", "SIGTERM"];

function forwardSignal(signal) {
  if (child.exitCode === null && child.signalCode === null) {
    child.kill(signal);
  }
}

for (const signal of forwardedSignals) {
  process.once(signal, () => forwardSignal(signal));
}

function removeSignalHandlers() {
  for (const signal of forwardedSignals) {
    process.removeAllListeners(signal);
  }
}

child.once("error", (error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

child.once("exit", (code, signal) => {
  removeSignalHandlers();
  if (signal !== null) {
    process.kill(process.pid, signal);
    return;
  }
  process.exitCode = code ?? 1;
});
