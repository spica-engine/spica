const {NxAppWebpackPlugin} = require("@nx/webpack/app-plugin");

module.exports = {
  plugins: [
    new NxAppWebpackPlugin({
      compiler: "tsc",
      tsConfig: "./tsconfig.json",
      optimization: false,
      outputHashing: "none",
      generatePackageJson: false
    })
  ]
};
