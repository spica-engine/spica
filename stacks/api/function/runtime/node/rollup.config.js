import commonjs from "rollup-plugin-commonjs";
import nodeResolve from "rollup-plugin-node-resolve";
import {terser} from "rollup-plugin-terser";

module.exports = {
  plugins: [
    nodeResolve({
      preferBuiltins: true
    }),
    commonjs(),
    terser()
  ],
  external: ["grpc", "path"],
  onwarn: (warning, next) => {
    if (warning.code === "THIS_IS_UNDEFINED") return;
    next(warning);
  }
};
