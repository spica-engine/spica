import peg from "pegjs";
import fs from "fs";
import path from "path";
import {fileURLToPath} from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const grammar = fs
  .readFileSync(path.join(__dirname, "grammar.pegjs"), {encoding: "utf8"})
  .toString();

const parser = peg.generate(grammar, {
  output: "parser"
});

export {parser};
