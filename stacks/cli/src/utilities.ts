import * as fs from "fs";
import * as os from "os";
import * as path from "path";

export function getRcPath() {
  return path.join(os.homedir(), ".spicarc");
}

export async function writeFile(fullPath: string, data: any): Promise<any> {
  const dirName = path.dirname(fullPath);
  await fs.promises.mkdir(dirName, {recursive: true});
  return fs.promises.writeFile(fullPath, data).then(_ => `${fullPath} created.`);
}

export function createAsset(kind: string, spec: any): Asset {
  let asset: Asset = {
    kind: kind,
    metadata: {name: spec._id},
    spec: spec
  };
  delete asset.spec._id;
  return asset;
}

interface Asset {
  kind: string;
  metadata: MetaData;
  spec: any;
}

interface MetaData {
  name: string; //id
}
