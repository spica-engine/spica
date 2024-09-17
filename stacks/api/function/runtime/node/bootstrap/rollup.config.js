import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import resolve, {nodeResolve} from "@rollup/plugin-node-resolve";
import {terser} from "rollup-plugin-terser";
import typescript from "@rollup/plugin-typescript";
import alias from "@rollup/plugin-alias";
import * as path from "path";

module.exports = {
  input: "./stacks/api/function/runtime/node/bootstrap/entrypoint.js",
  output: {
    dir: "./dist/stacks/api/function/runtime/node/bootstrap",
    format: "esm",
    sourcemap: true
  },
  plugins: [
    alias({
      entries: [
        {
          find: "@spica-server/*",
          replacement: path.join(process.cwd(), "stacks", "api")
        },
        {
          find: "@spica-devkit/database",
          replacement: path.join(process.cwd(), "stacks", "api", "function", "packages", "database")
        }
      ]
    }),
    resolve({
      extensions: [".js", ".ts"]
    }),
    nodeResolve({
      preferBuiltins: true
    }),
    typescript({
      module: "esnext",
      outDir: "./dist/stacks/api/function/runtime/node/bootstrap",
      sourceMap: true
    }),
    json(),
    commonjs({
      ignore: ["mongodb"]
    }),
    terser()
  ],
  external: ["path"]
};
