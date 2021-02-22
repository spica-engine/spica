import commonjs from "@rollup/plugin-commonjs";
import resolve from "@rollup/plugin-node-resolve";
import json from "@rollup/plugin-json";

module.exports = {
  output: {
    entryFileNames: "[name]"
  },
  plugins: [
    resolve({
      preferBuiltins: true
    }),
    commonjs(),
    json()
  ],
  external: ["mongodb", "axios", "ws"]
};
