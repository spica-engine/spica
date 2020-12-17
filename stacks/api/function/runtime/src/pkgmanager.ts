import * as child_process from "child_process";
import {discovery} from "./discovery";
import * as lock from "./lock";
import * as path from "path";

export interface Package {
  name: string;
  version: string;
}

export namespace pkgmanager {
  export interface Options {
    for: string;
    runtime: {
      name: string;
      version: string;
    };
  }

  async function invoke(options: Options, env: NodeJS.ProcessEnv) {
    const runtime = await discovery.get(options.runtime.name);
    await lock.acquire(
      options.runtime.name,
      options.runtime.version,
      runtime.prepare,
      path.join(discovery.root, runtime.name)
    );
    env.VERSION = options.runtime.version;
    env.TARGET_WD = options.for;

    return new Promise<{stderr: string; stdout: string}>((resolve, reject) => {
      child_process.exec(
        runtime.pkgmanager,
        {env, cwd: path.join(discovery.root, runtime.name)},
        (error, stdout, stderr) => {
          if (error) {
            return reject(stderr);
          }
          return resolve({stdout, stderr});
        }
      );
    });
  }

  export async function ls(options: Options): Promise<Package[]> {
    const {stdout} = await invoke(options, {COMMAND: "ls"});
    const packageJson = JSON.parse(stdout);
    const dependencies = packageJson.dependencies || {};
    return Object.keys(dependencies).reduce((packages, depName) => {
      packages.push({
        name: depName,
        version: dependencies[depName]
      });
      return packages;
    }, new Array<Package>());
  }

  export function install(options: Options, qualifiedNames: string | string[]): Promise<void> {
    qualifiedNames = Array.isArray(qualifiedNames) ? qualifiedNames.join(" ") : qualifiedNames;
    return invoke(options, {
      COMMAND: "install",
      NAME: qualifiedNames
    }).then(() => {});
  }

  export function uninstall(options: Options, name: string): Promise<void> {
    return invoke(options, {COMMAND: "uninstall", NAME: name}).then(() => {});
  }
}
