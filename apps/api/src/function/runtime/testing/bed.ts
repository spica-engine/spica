import * as fs from "fs";
import * as path from "path";

export class FunctionTestBed {
  static initialize(index: string, entrypoint = "index.ts"): string {
    const tmpdir = fs.mkdtempSync(path.join(process.env.TEST_TMPDIR, "fn"));
    fs.writeFileSync(path.join(tmpdir, entrypoint), index);
    return tmpdir;
  }
}
