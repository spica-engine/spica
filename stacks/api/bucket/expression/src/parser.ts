import * as peg from "pegjs";
import * as fs from "fs";
const runfiles = require(process.env.BAZEL_NODE_RUNFILES_HELPER);

const grammar = fs
  .readFileSync(runfiles.resolve("spica/stacks/api/bucket/expression/src/grammar.pegjs"), {
    encoding: "utf8"
  })
  .toString();

const parser = peg.generate(grammar, {
  output: "parser"
});

export {parser};
