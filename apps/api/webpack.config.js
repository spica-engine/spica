const {NxAppWebpackPlugin} = require("@nx/webpack/app-plugin");
const {join} = require("path");

const isServeTarget = process.env.NX_TASK_TARGET_TARGET === "serve";

module.exports = {
  entry: {
    main: join(__dirname, "/src/main.ts"),
    typescript_worker: join(__dirname, "/src/function/compiler/typescript/src/typescript_worker.ts")
  },
  output: {
    path: join(__dirname, "../../dist/apps/api"),
    filename: "[name].js"
  },
  plugins: [
    new NxAppWebpackPlugin({
      target: "node",
      compiler: "tsc",
      main: "./src/main.ts",
      tsConfig: "./tsconfig.json",
      optimization: false,
      outputHashing: "none",
      generatePackageJson: true,
      sourceMap: true
    })
  ],
  resolve: {
    extensions: [".ts", ".js"]
  },
  watch: isServeTarget,
  watchOptions: {
    ignored: /node_modules/,
    aggregateTimeout: 300,
    poll: 1000
  }
};
