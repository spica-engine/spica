import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import nodeResolve from "@rollup/plugin-node-resolve";
import {terser} from "rollup-plugin-terser";

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
  external: ["path"]
};
