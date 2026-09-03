import { isMainThread, parentPort, Worker } from "node:worker_threads";

const coordinateLimit = 10_000;
const durationLimitMs = 1_000;
const memoryLimitBytes = 256 * 1024 * 1024;

function maximumResidentBytes() {
  return process.resourceUsage().maxRSS * 1024;
}

async function runFixture() {
  const { contractDigest, parseContract } = await import(
    "../packages/core/dist/index.js"
  );
  const digest = `sha256:${"a".repeat(64)}`;
  const coordinates = Array.from({ length: coordinateLimit }, (_, index) => {
    const routeId = `route-${String(index).padStart(5, "0")}`;
    return {
      configFingerprint: digest,
      expected: { status: "passed" },
      id: `${routeId}/public/desktop/light`,
      routeId,
      routePath: `/${routeId}`,
      scenarioSource: "./scenarios/public.mjs",
      stateId: "public",
      theme: "light",
      viewport: { height: 900, width: 1440 },
      viewportId: "desktop",
    };
  });
  const source = JSON.stringify({
    configDigest: digest,
    coordinates,
    schemaVersion: 1,
  });

  const baselineRss = maximumResidentBytes();
  const started = performance.now();
  const contract = parseContract(source);
  const contractHash = contractDigest(contract);
  const elapsedMs = performance.now() - started;

  return {
    bytes: Buffer.byteLength(source),
    contractHash,
    coordinates: contract.coordinates.length,
    elapsedMs,
    additionalRssBytes: Math.max(0, maximumResidentBytes() - baselineRss),
  };
}

if (!isMainThread) {
  parentPort?.postMessage(await runFixture());
} else {
  const worker = new Worker(new URL(import.meta.url));
  const result = await new Promise((resolve, reject) => {
    worker.once("message", resolve);
    worker.once("error", reject);
    worker.once("exit", (code) => {
      if (code !== 0) {
        reject(new Error(`Contract benchmark worker exited with ${code}.`));
      }
    });
  });
  if (result.coordinates !== coordinateLimit) {
    throw new Error(`Contract benchmark parsed ${result.coordinates} coordinates.`);
  }
  if (!/^sha256:[a-f0-9]{64}$/u.test(result.contractHash)) {
    throw new Error("Contract benchmark produced an invalid digest.");
  }
  if (result.elapsedMs >= durationLimitMs) {
    throw new Error(
      `Contract benchmark took ${result.elapsedMs.toFixed(2)} ms; limit is ${durationLimitMs} ms.`,
    );
  }
  if (result.additionalRssBytes >= memoryLimitBytes) {
    throw new Error(
      `Contract benchmark added ${(result.additionalRssBytes / 1024 / 1024).toFixed(2)} MiB RSS; limit is 256 MiB.`,
    );
  }

  console.log(
    `Contract core benchmark passed: ${result.coordinates} coordinates, ` +
      `${result.elapsedMs.toFixed(2)} ms, ` +
      `${(result.additionalRssBytes / 1024 / 1024).toFixed(2)} MiB additional RSS, ` +
      `${result.bytes} source bytes.`,
  );
}
