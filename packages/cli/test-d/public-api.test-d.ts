import {
  ConfigDiscoveryError,
  ConfigLoadError,
  DEFAULT_CONFIG_FILENAMES,
  discoverConfig,
  loadConfig,
  type ConfigDiscoveryErrorCode,
  type ConfigDiscoveryOptions,
  type ConfigLoadErrorCode,
  type LoadedConfig,
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

void configPath;
void loadedConfig;
void filenames;
void discoveryError;
void loadError;

discoverConfig({
  // @ts-expect-error Config paths must be strings.
  configPath: 42,
});
