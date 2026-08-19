import { rm } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

export async function cleanPackage({ root = process.cwd() } = {}) {
  const outputDirectory = path.join(root, "dist");
  await rm(outputDirectory, { force: true, recursive: true });
  return outputDirectory;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await cleanPackage();
}
