const commonjs = require("@rollup/plugin-commonjs");
const json = require("@rollup/plugin-json");
const nodeResolve = require("@rollup/plugin-node-resolve").default;
const terser = require("rollup-plugin-terser").terser;

module.exports = {
  plugins: [
    nodeResolve({
      preferBuiltins: true
    }),
    json(),
    commonjs({
      ignore: ["mongodb"]
    }),
    terser()
  ],
  external: ["path"],
};
