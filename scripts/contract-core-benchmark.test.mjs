import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const benchmarkPath = path.join(
  path.resolve(import.meta.dirname, ".."),
  "scripts",
  "contract-core-benchmark.mjs",
);

test("contract benchmark warms the exact workload before enforcing the timing budget", async () => {
  const source = await readFile(benchmarkPath, "utf8");
  const baseline = source.indexOf("const baselineRss = maximumResidentBytes();");
  const warmup = source.indexOf("evaluateFixture();", baseline);
  const memoryMeasurement = source.indexOf(
    "const additionalRssBytes = Math.max(0, maximumResidentBytes() - baselineRss);",
    warmup,
  );
  const timer = source.indexOf("const started = performance.now();", memoryMeasurement);
  const measured = source.indexOf(
    "const { comparison, contract, contractHash } = evaluateFixture();",
    timer,
  );

  assert.ok(baseline >= 0, "the memory baseline must be explicit");
  assert.ok(warmup > baseline, "the warm-up must remain inside the memory budget");
  assert.ok(
    memoryMeasurement > warmup,
    "the first exact pass must prove the memory budget",
  );
  assert.ok(timer > memoryMeasurement, "the timer must begin after the warm-up");
  assert.ok(measured > timer, "the exact workload must execute again inside the timing budget");
  assert.equal(
    source.match(/const durationLimitMs = 1_000;/gu)?.length,
    1,
    "the one-second performance requirement must not be relaxed",
  );
  assert.equal(
    source.match(/const memoryLimitBytes = 256 \* 1024 \* 1024;/gu)?.length,
    1,
    "the 256 MiB memory requirement must not be relaxed",
  );
});
