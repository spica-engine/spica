import commonjs from "rollup-plugin-commonjs";
import nodeResolve from "rollup-plugin-node-resolve";
import json from "@rollup/plugin-json";
import {terser} from "rollup-plugin-terser";
import * as fs from "fs";

const outputDirIndex = process.argv.findIndex(arg => arg == "--output.dir");

const outputDir = process.argv[outputDirIndex + 1];

module.exports = {
  plugins: [
    nodeResolve({
      preferBuiltins: true
    }),
    commonjs({
      ignore: ["mongodb"]
    }),
    json(),
    terser(),
    {
      name: "copy-package-json",
      buildEnd: (...args) => {
        console.log(`${outputDir}/package.json`);
        fs.writeFileSync(`${outputDir}/package.json`, '{"type": "module"}');
      }
    }
  ],
  external: ["path"]
};
