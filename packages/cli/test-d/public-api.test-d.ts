import {
  CheckError,
  ConfigDiscoveryError,
  ConfigLoadError,
  DEFAULT_CONFIG_FILENAMES,
  checkPublicSite,
  discoverConfig,
  defineConfig,
  initProject,
  loadConfig,
  openReport,
  runCli,
  scanProject,
  InitError,
  OpenReportError,
  ScanError,
  type CheckErrorCode,
  type CheckDiscovery,
  type CheckOptions,
  type CheckResult,
  type ConfigDiscoveryErrorCode,
  type ConfigDiscoveryOptions,
  type ConfigLoadErrorCode,
  type LoadedConfig,
  type CliExitCode,
  type InitErrorCode,
  type InitOptions,
  type InitResult,
  type OpenReportErrorCode,
  type OpenReportOptions,
  type OpenReportResult,
  type RunCliOptions,
  type ScanErrorCode,
  type ScanOptions,
  type ScanResult,
} from "statecraft-ui";

const checkOptions: CheckOptions = {
  cwd: "/tmp/example",
  headed: false,
  maxPages: 5,
  url: "https://example.com",
};
const checkResult: Promise<CheckResult> = checkPublicSite(checkOptions);
const checkDiscovery: Promise<CheckDiscovery> = checkResult.then(
  (result) => result.discovery,
);
const checkCode: CheckErrorCode = "CHECK_DISCOVERY_FAILED";
const checkRootCode: CheckErrorCode = "CHECK_ROOT_INVALID";
const checkError: Error = new CheckError(checkCode, "Discovery failed.");

const options: ConfigDiscoveryOptions = {
  configPath: "./config/statecraft.config.mjs",
  cwd: "/tmp/example",
};
const configPath: Promise<string> = discoverConfig(options);
const loadedConfig: Promise<LoadedConfig> = loadConfig(options);
const discoveryCode: ConfigDiscoveryErrorCode = "CONFIG_NOT_FOUND";
const loadCode: ConfigLoadErrorCode = "CONFIG_IMPORT_FAILED";
const filenames: readonly string[] = DEFAULT_CONFIG_FILENAMES;
const discoveryError: Error = new ConfigDiscoveryError(
  discoveryCode,
  "Config missing.",
);
const loadError: Error = new ConfigLoadError(
  loadCode,
  "Config failed.",
  "/tmp/example/statecraft.config.mjs",
);
const initOptions: InitOptions = { cwd: "/tmp/example" };
const initResult: Promise<InitResult> = initProject(initOptions);
const initCode: InitErrorCode = "INIT_CONFLICT";
const initError: Error = new InitError(initCode, "Already exists.");
const openOptions: OpenReportOptions = { cwd: "/tmp/example" };
const openResult: Promise<OpenReportResult> = openReport(openOptions);
const openCode: OpenReportErrorCode = "OPEN_REPORT_NOT_FOUND";
const openError: Error = new OpenReportError(
  openCode,
  "Report missing.",
  "/tmp/example/.statecraft/report/index.html",
);
const cliOptions: RunCliOptions = {
  args: ["init"],
  stdout: (message) => void message,
};
const cliResult: Promise<CliExitCode> = runCli(cliOptions);
const scanOptions: ScanOptions = {
  configPath: "./config/statecraft.config.mjs",
  cwd: "/tmp/example",
  headed: false,
  routeId: "home",
};
const scanResult: Promise<ScanResult> = scanProject(scanOptions);
const htmlReportPath: Promise<".statecraft/report/index.html"> = scanResult.then(
  (result) => result.htmlReportPath,
);
const scanCode: ScanErrorCode = "SCAN_ROUTE_NOT_FOUND";
const scanError: Error = new ScanError(scanCode, "Route missing.", "missing");
const typedConfig = defineConfig({
  baseURL: "http://localhost:3000",
  routes: [
    { id: "home", path: "/", states: [{ id: "success", setup: "./success.ts" }] },
  ],
  themes: ["light"],
  viewports: { desktop: { height: 800, width: 1200 } },
});

void configPath;
void checkResult;
void checkDiscovery;
void checkError;
void checkRootCode;
void loadedConfig;
void filenames;
void discoveryError;
void loadError;
void initResult;
void initError;
void openResult;
void openError;
void cliResult;
void scanResult;
void htmlReportPath;
void scanError;
void typedConfig;

discoverConfig({
  // @ts-expect-error Config paths must be strings.
  configPath: 42,
});
