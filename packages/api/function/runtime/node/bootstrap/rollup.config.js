import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import resolve, {nodeResolve} from "@rollup/plugin-node-resolve";
import terser from "@rollup/plugin-terser";
import typescript from "@rollup/plugin-typescript";
import copy from "rollup-plugin-copy";

module.exports = {
  input: "./packages/api/function/runtime/node/bootstrap/entrypoint.js",
  output: {
    dir: "./dist/packages/api/function/runtime/node/bootstrap",
    format: "esm",
    sourcemap: true
  },
  plugins: [
    resolve({
      extensions: [".js", ".ts"]
    }),
    nodeResolve({
      preferBuiltins: true
    }),
    typescript({
      outDir: "./dist/packages/api/function/runtime/node/bootstrap",
      tsconfig: "./packages/api/function/runtime/node/bootstrap/tsconfig.rollup.json"
    }),
    json(),
    commonjs({
      ignore: ["mongodb"]
    }),
    terser(),
    copy({
      targets: [
        {
          src: "./packages/api/function/runtime/node/bootstrap/package.json",
          dest: "./dist/packages/api/function/runtime/node/bootstrap"
        }
      ]
    })
  ],
  external: ["path"]
};
