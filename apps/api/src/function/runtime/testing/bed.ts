import {Compilation} from "@spica-server/interface/function/compiler";
import fs from "fs";
import path from "path";

export class FunctionTestBed {
  static initialize(index: string, compilation: Compilation): string {
    // Create a unique function directory
    const functionName = `fn-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const testRoot = process.env.TEST_TMPDIR;
    const functionDir = path.join(testRoot, functionName);

    // Create function directory
    fs.mkdirSync(functionDir, {recursive: true});

    // Write source file
    fs.writeFileSync(path.join(functionDir, compilation.entrypoints.build), index);

    // Write package.json pointing to build
    fs.writeFileSync(
      path.join(functionDir, "package.json"),
      `{
          "name": "${functionName}",
          "description": "No description.",
          "version": "0.0.1",
          "private": true,
          "keywords": ["spica", "function", "node.js"],
          "license": "UNLICENSED",
          "main": "${path.join("..", compilation.outDir, functionName, compilation.entrypoints.runtime)}"
      }`
    );

    return functionDir;
  }
}
