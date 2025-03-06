import {Compilation} from "@spica-server/function/compiler";
import fs from "fs";
import path from "path";

export class FunctionTestBed {
  static initialize(index: string, compilation: Compilation): string {
    const tmpdir = fs.mkdtempSync(path.join(process.env.TEST_TMPDIR, "fn"));
    fs.writeFileSync(path.join(tmpdir, compilation.entrypoints.build), index);
    fs.writeFileSync(
      path.join(tmpdir, "package.json"),
      `{
          "name":" testbed-fn",
          "description": "No description.",
          "version": "0.0.1",
          "private": true,
          "keywords": ["spica", "function", "node.js"],
          "license": "UNLICENSED",
          "main": "${path.join(".", compilation.outDir, compilation.entrypoints.runtime)}"
      }`
    );

    return tmpdir;
  }
}
