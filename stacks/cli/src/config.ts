import {cosmiconfig} from "cosmiconfig";
import * as fs from "fs";

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
      `.spicarc.cjs`
    ]
  });

  export async function get(): Promise<Config> {
    const config = await explorer.search();
    if (!config) {
      return {context: undefined};
    }
    return config.config;
  }

  export async function path(): Promise<string | undefined> {
    try {
      const {filepath} = await explorer.search();
      return filepath;
    } catch {
      return undefined;
    }
  }

  export async function set(config: Config) {
    const configPath = await path();
    fs.writeFileSync(configPath, JSON.stringify(config, undefined, 2));
  }
}
