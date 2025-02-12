import {cosmiconfig} from "cosmiconfig";
import fs from "fs";
import os from "os";
import _path from "path";

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

  export async function has() {
    const config = await get();
    return !!config.context;
  }

  export async function get(): Promise<Config> {
    let searchResult = await explorer.search(process.cwd());
    if (!searchResult) {
      searchResult = await explorer.search(os.homedir());
    }

    if (!searchResult || !searchResult.config || !searchResult.config.context) {
      throw new Error(
        `No context has been selected.\n$ spica context switch <name> to switch context.`
      );
    }

    return searchResult.config;
  }

  export async function path(): Promise<string | undefined> {
    let config = await explorer.search(process.cwd());
    if (!config) {
      config = await explorer.search(os.homedir());
    }

    if (config) {
      return config.filepath;
    }
    return undefined;
  }

  export async function set(config: Config) {
    let configPath = await path();
    if (!configPath) {
      configPath = _path.join(os.homedir(), ".spicarc");
    }
    fs.writeFileSync(configPath, JSON.stringify(config, undefined, 2));
  }
}
