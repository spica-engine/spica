import commonjs from "rollup-plugin-commonjs";
import nodeResolve from "rollup-plugin-node-resolve";
import json from "@rollup/plugin-json";
import {terser} from "rollup-plugin-terser";

module.exports = {
  plugins: [
    nodeResolve({
      preferBuiltins: true
    }),
    commonjs({
      ignore: ["v8-compile-cache"]
    }),
    terser(),
    json()
  ],
  external: ["path"]
};
