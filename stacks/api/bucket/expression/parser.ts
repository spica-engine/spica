const peg = require("pegjs");
const fs = require("fs");

const grammar = fs.readFileSync(__dirname + "/cel.grammar.pegjs", { encoding: "utf8"}).toString()

const parser = peg.generate(grammar, {
    output: "parser"
})

export {parser}