import { mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { chromium } from "playwright";

const exampleRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const repositoryRoot = path.resolve(exampleRoot, "..", "..");
const reportPath = path.join(
  exampleRoot,
  ".statecraft",
  "report",
  "index.html",
);
const assetsRoot = path.join(repositoryRoot, "docs", "assets");
const overviewPath = path.join(assetsRoot, "statecraft-report-overview.png");
const failurePath = path.join(assetsRoot, "statecraft-failure-detail.png");

async function requireReport(sourceReportPath) {
  let report;
  try {
    report = await stat(sourceReportPath);
  } catch {
    throw new Error(
      "No example report found. Run the documented Northline scan before capturing launch assets.",
    );
  }
  if (!report.isFile()) {
    throw new Error(`Example report is not a regular file: ${sourceReportPath}`);
  }
}

export function launchDetailSelector(detailId) {
  if (!detailId || !/^execution-\d+$/u.test(detailId)) {
    throw new Error("Approved launch failure does not reference a valid detail view.");
  }
  return `#${detailId}`;
}

export async function captureLaunchAssets({
  browserType = chromium,
  logger = console,
  sourceReportPath = reportPath,
  targetAssetsRoot = assetsRoot,
} = {}) {
  await requireReport(sourceReportPath);
  await mkdir(targetAssetsRoot, { recursive: true });

  const targetOverviewPath = path.join(
    targetAssetsRoot,
    path.basename(overviewPath),
  );
  const targetFailurePath = path.join(
    targetAssetsRoot,
    path.basename(failurePath),
  );

  const browser = await browserType.launch({ headless: true });
  try {
    const page = await browser.newPage({
      deviceScaleFactor: 1,
      viewport: { height: 1_000, width: 1_440 },
    });
    await page.route(/^https?:/u, (route) => route.abort());
    await page.goto(pathToFileURL(sourceReportPath).href);

    await page.screenshot({ path: targetOverviewPath });

    const failure = page.getByRole("link", {
      exact: true,
      name: "customers long-content, mobile, light: failed",
    });
    if ((await failure.count()) !== 1) {
      throw new Error(
        "Expected the approved customer long-content failure in the example report.",
      );
    }
    const detailId = await failure.getAttribute("aria-controls");
    const detailSelector = launchDetailSelector(detailId);
    await failure.click();
    await page.locator(detailSelector).screenshot({ path: targetFailurePath });
  } finally {
    await browser.close();
  }

  logger.log(`Captured ${path.relative(repositoryRoot, targetOverviewPath)}`);
  logger.log(`Captured ${path.relative(repositoryRoot, targetFailurePath)}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await captureLaunchAssets();
}
