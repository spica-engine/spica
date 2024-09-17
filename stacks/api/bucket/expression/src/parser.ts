import * as peg from "pegjs";
import * as fs from "fs";
import * as path from "path";

const grammar = fs
  .readFileSync(path.join(__dirname, "grammar.pegjs"), {encoding: "utf8"})
  .toString();

const parser = peg.generate(grammar, {
  output: "parser"
});

export {parser};
