import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import {nodeResolve} from "@rollup/plugin-node-resolve";
import terser from "@rollup/plugin-terser";
import typescript from "@rollup/plugin-typescript";

module.exports = {
  input: "./packages/api/function/runtime/node/bootstrap/entrypoint.ts",
  output: {
    dir: "./packages/api/function/runtime/node/dist/bootstrap",
    format: "esm",
    sourcemap: true
  },
  plugins: [
    nodeResolve({
      preferBuiltins: true
    }),
    typescript({
      tsconfig: "./packages/api/function/runtime/node/bootstrap/tsconfig.json",
      compilerOptions: {
        composite: false,
        declaration: false,
        declarationMap: false,
        sourceMap: true,
        outDir: "./packages/api/function/runtime/node/dist/bootstrap"
      }
    }),
    json(),
    commonjs({
      ignore: ["mongodb"]
    }),
    terser()
  ]
};
