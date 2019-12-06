import commonjs from "rollup-plugin-commonjs";
import nodeResolve from "rollup-plugin-node-resolve";

module.exports = {
  plugins: [
    nodeResolve({
      preferBuiltins: true
    }),
    commonjs()
  ],
  external: ["grpc", "path"],
  onwarn: (warning, next) => {
    if (warning.code === "THIS_IS_UNDEFINED") return;
    next(warning);
  }
};
