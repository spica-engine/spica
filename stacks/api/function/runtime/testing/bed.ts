import * as fs from "fs";
import * as os from "os";
import * as path from "path";

export class FunctionTestBed {
  static initialize(index: string, entrypoint = "index.ts"): string {
    const tmpdir = path.join(os.tmpdir(), fs.mkdtempSync("fn"));
    fs.mkdirSync(tmpdir, {recursive: true});
    fs.writeFileSync(path.join(tmpdir, entrypoint), index);
    return tmpdir;
  }
}
