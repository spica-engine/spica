import * as fs from "fs";
import * as os from "os";
import * as path from "path";

export function getRcPath() {
  return path.join(os.homedir(), ".spicarc");
}

export async function writeFile(fullPath: string, data: any): Promise<any> {
  const dirName = path.dirname(fullPath);
  await fs.promises.mkdir(dirName, {recursive: true});
  return fs.promises.writeFile(fullPath, data);
}
