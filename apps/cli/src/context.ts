import fs from "fs";
import os from "os";
import path from "path";
import {config} from "./config";

export namespace context {
  const ctxPath = path.join(os.homedir(), ".spicactx");

  function load(): {[name: string]: Context} {
    if (!fs.existsSync(ctxPath)) {
      return {};
    }

    return JSON.parse(fs.readFileSync(ctxPath).toString());
  }

  function write(ctxs: {[name: string]: Context}): void {
    fs.writeFileSync(ctxPath, JSON.stringify(ctxs));
  }

  export interface Context {
    url: string;
    authorization: string;
  }

  export function set(name: string, data: {url: string; authorization: string}) {
    const cxts = load();
    cxts[name] = data;
    write(cxts);
  }

  export function has(name: string) {
    const cxts = load();
    return !!cxts[name];
  }

  export function get(name: string): Context | undefined {
    const cxts = load();
    const ctx = cxts[name];

    if (!ctx) {
      throw new Error(
        `Could not find the context ${name}\n$ spica context set --name="${name}" --apikey="<APIKEY_HERE>" to create this context.`
      );
    }

    return ctx;
  }

  export async function getCurrent() {
    const {context: name} = await config.get();
    return get(name);
  }

  export function list(): Array<Context & {name: string}> {
    const cxts = load();
    return Object.entries(cxts).map(([name, ctx]) => ({...ctx, name}));
  }

  export function remove(name: string) {
    const cxts = load();
    delete cxts[name];
    write(cxts);
  }
}
