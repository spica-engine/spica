const {NxAppWebpackPlugin} = require("@nx/webpack/app-plugin");
const {join} = require("path");

module.exports = {
  output: {
    path: join(__dirname, "../../dist/apps/api")
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
  ]
};
