import {BuildMeta} from "@spica-server/interface-function-builder";
import fs from "fs";
import path from "path";

export class FunctionTestBed {
  static initialize(index: string, meta: BuildMeta): string {
    const functionsRoot = fs.mkdtempSync(path.join(process.env.TEST_TMPDIR, "functions-"));

    const tmpdir = path.join(functionsRoot, "testbed-fn");
    fs.mkdirSync(tmpdir, {recursive: true});

    fs.writeFileSync(path.join(tmpdir, meta.entrypoints.build), index);
    fs.writeFileSync(
      path.join(tmpdir, "package.json"),
      `{
          "name": "testbed-fn",
          "description": "No description.",
          "version": "0.0.1",
          "private": true,
          "keywords": ["spica", "function", "node.js"],
          "license": "UNLICENSED",
          "main": "${path.join(".", meta.outDir, meta.entrypoints.runtime)}"
      }`
    );

    return tmpdir;
  }
}
