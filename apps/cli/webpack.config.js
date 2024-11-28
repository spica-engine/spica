const {NxAppWebpackPlugin} = require("@nx/webpack/app-plugin");
const {join} = require("path");

module.exports = {
  plugins: [
    new NxAppWebpackPlugin({
      target: "node",
      compiler: "tsc",
      tsConfig: "./tsconfig.json",
      optimization: false,
      outputHashing: "none",
      generatePackageJson: true,
      sourceMap: true
    })
  ]
};
