import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import resolve, {nodeResolve} from "@rollup/plugin-node-resolve";
import terser from "@rollup/plugin-terser";
import typescript from "@rollup/plugin-typescript";
import copy from "rollup-plugin-copy";

module.exports = {
  input: "./packages/api/function/runtime/node/bootstrap/entrypoint.js",
  output: {
    dir: "./packages/api/function/runtime/node/dist/bootstrap",
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
      outDir: "./packages/api/function/runtime/node/dist/bootstrap",
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
          dest: "./packages/api/function/runtime/node/dist/bootstrap"
        }
      ]
    })
  ],
  external: ["path"]
};
