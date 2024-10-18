import * as fs from "fs";
import * as path from "path";

export class FunctionTestBed {
  static initialize(index: string, entrypoint = "index.ts"): string {
    const tmpdir = path.join(process.env.TEST_TMPDIR, fs.mkdtempSync("fn"));
    fs.mkdirSync(tmpdir);
    fs.writeFileSync(path.join(tmpdir, entrypoint), index);
    return tmpdir;
  }
}
