import { isMainThread, parentPort, Worker } from "node:worker_threads";

const coordinateLimit = 10_000;
const durationLimitMs = 1_000;
const memoryLimitBytes = 256 * 1024 * 1024;

function maximumResidentBytes() {
  return process.resourceUsage().maxRSS * 1024;
}

async function runFixture() {
  const {
    compareContract,
    contractConfigDigest,
    contractDigest,
    parseContract,
  } = await import(
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
  const configuration = coordinates.map((coordinate) => ({
    configFingerprint: coordinate.configFingerprint,
    id: coordinate.id,
    routeId: coordinate.routeId,
    routePath: coordinate.routePath,
    scenarioSource: coordinate.scenarioSource,
    stateId: coordinate.stateId,
    theme: coordinate.theme,
    viewport: coordinate.viewport,
    viewportId: coordinate.viewportId,
  }));
  const configDigest = contractConfigDigest(configuration);
  const source = JSON.stringify({
    configDigest,
    coordinates,
    schemaVersion: 1,
  });
  const executions = configuration.map((coordinate) => ({
    failures: [],
    routeId: coordinate.routeId,
    stateId: coordinate.stateId,
    status: "passed",
    theme: coordinate.theme,
    viewportId: coordinate.viewportId,
  }));

  const evaluateFixture = () => {
    const contract = parseContract(source);
    const contractHash = contractDigest(contract);
    const comparison = compareContract({
      complete: true,
      configuration,
      contract,
      executions,
      now: () => new Date("2026-09-03T00:00:00.000Z"),
    });
    return { comparison, contract, contractHash };
  };

  const baselineRss = maximumResidentBytes();
  evaluateFixture();
  const additionalRssBytes = Math.max(0, maximumResidentBytes() - baselineRss);
  const started = performance.now();
  const { comparison, contract, contractHash } = evaluateFixture();
  const elapsedMs = performance.now() - started;

  return {
    bytes: Buffer.byteLength(source),
    contractHash,
    coordinates: contract.coordinates.length,
    elapsedMs,
    verdict: comparison.verdict,
    additionalRssBytes,
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
  if (result.verdict !== "passed") {
    throw new Error(`Contract benchmark comparison returned ${result.verdict}.`);
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
