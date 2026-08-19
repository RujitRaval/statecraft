export {
  defineConfig,
  parseConfig,
} from "./config.js";
export type {
  FailurePolicy,
  RouteDefinition,
  StateDefinition,
  StatecraftConfig,
  ViewportDefinition,
} from "./config.js";
export { ConfigValidationError, StatecraftError } from "./errors.js";
export type {
  ConfigValidationIssue,
  ConfigValidationIssueCode,
  StatecraftErrorCode,
} from "./errors.js";
export { expandMatrix } from "./matrix.js";
export type { MatrixCell, MatrixFilter } from "./matrix.js";
export { screenshotArtifactPath } from "./artifacts.js";
export type { ScreenshotArtifactPath } from "./artifacts.js";
