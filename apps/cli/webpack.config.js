const {NxAppWebpackPlugin} = require("@nx/webpack/app-plugin");
const {join} = require("path");

module.exports = {
  output: {
    filename: "index.js",
    library: {
      name: "SpicaCLI",
      type: "umd"
    }
  },
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
