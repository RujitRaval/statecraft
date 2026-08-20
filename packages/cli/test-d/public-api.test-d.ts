import {
  ConfigDiscoveryError,
  ConfigLoadError,
  DEFAULT_CONFIG_FILENAMES,
  discoverConfig,
  defineConfig,
  initProject,
  loadConfig,
  runCli,
  InitError,
  type ConfigDiscoveryErrorCode,
  type ConfigDiscoveryOptions,
  type ConfigLoadErrorCode,
  type LoadedConfig,
  type CliExitCode,
  type InitErrorCode,
  type InitOptions,
  type InitResult,
  type RunCliOptions,
} from "@statecraft/cli";

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
const cliOptions: RunCliOptions = {
  args: ["init"],
  stdout: (message) => void message,
};
const cliResult: Promise<CliExitCode> = runCli(cliOptions);
const typedConfig = defineConfig({
  baseURL: "http://localhost:3000",
  routes: [
    { id: "home", path: "/", states: [{ id: "success", setup: "./success.ts" }] },
  ],
  themes: ["light"],
  viewports: { desktop: { height: 800, width: 1200 } },
});

void configPath;
void loadedConfig;
void filenames;
void discoveryError;
void loadError;
void initResult;
void initError;
void cliResult;
void typedConfig;

discoverConfig({
  // @ts-expect-error Config paths must be strings.
  configPath: 42,
});
