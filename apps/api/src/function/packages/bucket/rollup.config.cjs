import commonjs from "@rollup/plugin-commonjs";
import resolve from "@rollup/plugin-node-resolve";
import json from "@rollup/plugin-json";
import typescript from "@rollup/plugin-typescript";

module.exports = {
  input: "./apps/api/src/function/packages/bucket/src/index.ts",
  output: [
    {
      dir: "./dist/apps/api/src/function/packages/bucket",
      format: "cjs",
      sourcemap: true,
      declaration: true,
      entryFileNames: "index.js"
    },
    {
      dir: "./dist/apps/api/src/function/packages/bucket",
      format: "esm",
      sourcemap: true,
      declaration: true,
      entryFileNames: "index.mjs"
    }
  ],
  plugins: [
    resolve({
      preferBuiltins: true
    }),
    commonjs(),
    json(),
    typescript({
      tsconfig: "./apps/api/src/function/packages/bucket/tsconfig.json",
      outDir: "./dist/apps/api/src/function/packages/bucket/"
    })
  ],
  external: ["mongodb", "axios", "ws"]
};
