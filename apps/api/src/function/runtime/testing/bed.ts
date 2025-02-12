import fs from "fs";
import path from "path";

export class FunctionTestBed {
  static initialize(index: string, entrypoint = "index.ts"): string {
    const tmpdir = fs.mkdtempSync(path.join(process.env.TEST_TMPDIR, "fn"));
    fs.writeFileSync(path.join(tmpdir, entrypoint), index);
    fs.writeFileSync(
      path.join(tmpdir, "package.json"),
      `{
          "name":" testbed-fn",
          "description": "No description.",
          "version": "0.0.1",
          "private": true,
          "keywords": ["spica", "function", "node.js"],
          "license": "UNLICENSED",
          "type": "module"
      }`
    );

    return tmpdir;
  }
}
