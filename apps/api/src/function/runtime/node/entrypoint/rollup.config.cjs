const commonjs = require("@rollup/plugin-commonjs");
const json = require("@rollup/plugin-json");
const resolve = require("@rollup/plugin-node-resolve").default;
const {nodeResolve} = require("@rollup/plugin-node-resolve");
const {terser} = require("rollup-plugin-terser");
const typescript = require("@rollup/plugin-typescript").default;
const alias = require("@rollup/plugin-alias").default;
const path = require("path");

module.exports = {
  input: "./apps/api/src/function/runtime/node/entrypoint/src/entrypoint.js",
  output: {
    dir: "./dist/worker",
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
          replacement: path.join(process.cwd(), "apps", "api", "function", "packages", "database")
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
      outDir: "./dist/apps/api/function/runtime/node",
      sourceMap: true
    }),
    json({}),
    commonjs({
      ignore: ["mongodb"]
    }),
    terser()
  ],
  external: ["path"]
};
