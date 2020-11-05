import {Description} from "./runtime";
import * as fs from "fs";
import * as path from "path";

export namespace discovery {
  let _descriptions: Map<string, Description>;

  export let root: string;

  export async function discover(): Promise<Map<string, Description>> {
    if (_descriptions) {
      return _descriptions;
    }
    const runtimePaths = await fs.promises.readdir(root);
    const descriptions = new Map<string, Description>();
    for (const runtimePathChunk of runtimePaths) {
      const runtimePath = path.join(root, runtimePathChunk);
      try {
        await fs.promises.access(runtimePath);
        const rawDescription = await fs.promises.readFile(path.join(runtimePath, "runtime.json"));
        const description: Description = JSON.parse(rawDescription.toString());
        descriptions.set(description.name, description);
      } catch (e) {
        console.log(`Skipping ${runtimePath}: ${e}`);
      }
    }
    return (_descriptions = descriptions);
  }
}
