import * as peg from "pegjs";
import * as fs from "fs";

const grammar = fs.readFileSync(__dirname + "/grammar.pegjs", {encoding: "utf8"}).toString();

const parser = peg.generate(grammar, {
  output: "parser"
});

export {parser};
