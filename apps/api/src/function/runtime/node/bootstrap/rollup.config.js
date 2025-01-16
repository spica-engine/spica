import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import resolve, {nodeResolve} from "@rollup/plugin-node-resolve";
import {terser} from "rollup-plugin-terser";
import typescript from "@rollup/plugin-typescript";
import alias from "@rollup/plugin-alias";
import copy from "rollup-plugin-copy";
import * as path from "path";

module.exports = {
  input: "./apps/api/src/function/runtime/node/bootstrap/entrypoint.js",
  output: {
    dir: "./dist/apps/api/src/function/runtime/node/bootstrap",
    format: "esm",
    sourcemap: true
  },
  plugins: [
    alias({
      entries: [
        {
          find: "@spica-server/*",
          replacement: path.join(process.cwd(), "apps", "api")
        },
        {
          find: "@spica-devkit/database",
          replacement: path.join(
            process.cwd(),
            "apps",
            "api",
            "src",
            "function",
            "packages",
            "database"
          )
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
      outDir: "./dist/apps/api/src/function/runtime/node/bootstrap",
      tsconfig: "./apps/api/src/function/runtime/node/bootstrap/tsconfig.json",
    }),
    json(),
    commonjs({
      ignore: ["mongodb"]
    }),
    terser(),
    copy({
      targets: [
        {
          src: "./apps/api/src/function/runtime/node/bootstrap/package.json",
          dest: "./dist/apps/api/src/function/runtime/node/bootstrap"
        }
      ]
    })
  ],
  external: ["path"]
};
