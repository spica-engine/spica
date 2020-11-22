import {cosmiconfig} from "cosmiconfig";
import * as fs from "fs";
import * as _path from "path";
import * as os from "os";

export namespace config {
  export interface Config {
    context: string;
  }

  const explorer = cosmiconfig("spica", {
    searchPlaces: [
      `.spicarc`,
      `.spicarc.json`,
      `.spicarc.yaml`,
      `.spicarc.yml`,
      `.spicarc.js`,
      `.spicarc.cjs`,
      `spica.config.js`,
      `spica.config.cjs`
    ]
  });

  export async function get(): Promise<Config> {
    const config = await explorer.search();
    if (!config) {
      return {context: undefined};
    }
    return config.config;
  }

  export async function path(): Promise<string> {
    try {
      const {filepath} = await explorer.search();
      return filepath;
    } catch {
      return _path.join(os.homedir(), ".spicarc");
    }
  }

  export async function set(config: Config) {
    const configPath = await path();
    fs.writeFileSync(configPath, JSON.stringify(config, undefined, 2));
  }
}
