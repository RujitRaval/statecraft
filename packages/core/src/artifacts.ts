import { createHash } from "node:crypto";

import type { MatrixCell } from "./matrix.js";

const artifactsRoot = ".statecraft/artifacts";
const maxEncodedSegmentLength = 120;
const sha256HexLength = 64;
const digestMarker = "~~";
const readablePrefixLength =
  maxEncodedSegmentLength - digestMarker.length - sha256HexLength;
const lowercaseLetterOrDigit = /^[a-z0-9]$/;
const windowsReservedBasename =
  /^(?:aux|com[1-9]|con|lpt[1-9]|nul|prn)$/;
declare const screenshotArtifactPathBrand: unique symbol;

/** An opaque project-relative PNG path produced by {@link screenshotArtifactPath}. */
export type ScreenshotArtifactPath = string & {
  readonly [screenshotArtifactPathBrand]: true;
};

function encodeCodePoint(codePoint: number): string {
  return `~${codePoint.toString(16).toUpperCase().padStart(6, "0")}`;
}

function boundSegment(encoded: string): string {
  if (encoded.length <= maxEncodedSegmentLength) {
    return encoded;
  }

  const digest = createHash("sha256").update(encoded, "utf8").digest("hex");
  return `${encoded.slice(0, readablePrefixLength)}${digestMarker}${digest}`;
}

function encodeSegment(value: string, encodeHyphen: boolean): string {
  if (value.length === 0) {
    return "~";
  }

  let encoded = "";
  for (const character of value) {
    if (
      lowercaseLetterOrDigit.test(character) ||
      (!encodeHyphen && character === "-")
    ) {
      encoded += character;
      continue;
    }

    const codePoint = character.codePointAt(0);
    if (codePoint === undefined) {
      continue;
    }
    encoded += encodeCodePoint(codePoint);
  }

  if (!encodeHyphen && windowsReservedBasename.test(encoded)) {
    encoded = `${encodeCodePoint(encoded.codePointAt(0)!)}${encoded.slice(1)}`;
  }

  return boundSegment(encoded);
}

/**
 * Returns the stable, project-relative PNG path for a matrix cell without
 * reading or writing the filesystem.
 *
 * Validated route and state IDs remain readable directory names. Filename
 * segments encode hyphens and every non-lowercase-alphanumeric code point so
 * the viewport/theme boundary is unambiguous and paths remain distinct on
 * case-insensitive and Unicode-normalizing filesystems. Windows-reserved route
 * and state basenames are encoded before they become directory names. Long
 * segments retain a readable prefix and add a SHA-256 digest within a fixed
 * component budget.
 */
export function screenshotArtifactPath(
  cell: MatrixCell,
): ScreenshotArtifactPath {
  const routeId = encodeSegment(cell.route.id, false);
  const stateId = encodeSegment(cell.state.id, false);
  const viewportId = encodeSegment(cell.viewportId, true);
  const theme = encodeSegment(cell.theme, true);

  return `${artifactsRoot}/${routeId}/${stateId}/${viewportId}-${theme}.png` as ScreenshotArtifactPath;
}
