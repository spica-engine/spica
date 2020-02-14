const fs = require("fs");
const path = require("path");
const isBinary = require("isbinaryfile").isBinaryFileSync;

function unquoteArgs(s) {
  return s.replace(/^'(.*)'$/, "$1");
}

function getMappingsFromVolatileFile(stampFilePath) {
  const stampFileLines = fs
    .readFileSync(stampFilePath, {encoding: "utf-8"})
    .trim()
    .split("\n");
  const stampMap = {};
  for (const line of stampFileLines) {
    const [key, value] = line.split(" ");
    stampMap[key] = value;
  }
  return stampMap;
}

function normalizeSubstitutions(substitutionsArg, stampFilePath) {
  const substitutions = JSON.parse(substitutionsArg);
  const stampMap = getMappingsFromVolatileFile(stampFilePath);

  const normalizedSubstitutions = {};

  for (const occurrence in substitutions) {
    let substituteWith = substitutions[occurrence];
    if (substituteWith.match(/^{.*?}$/)) {
      substituteWith = substituteWith.replace(/^{(.*?)}$/, "$1");
      if (!stampMap[substituteWith]) {
        throw new Error(`Could not find ${substituteWith} key in volatile-status file.`);
      }
      substituteWith = stampMap[substituteWith];
      normalizedSubstitutions[occurrence] = substituteWith;
    }
  }
  return normalizedSubstitutions;
}

function relative(execPath) {
  if (execPath.startsWith("external/")) {
    execPath = execPath.substring("external/".length);
  }
  return execPath;
}

function copyWithReplace(f, outDir, substitutions) {
  if (fs.statSync(f).isDirectory()) {
    for (const file of fs.readdirSync(f)) {
      copyWithReplace(path.join(f, file));
    }
  } else if (!isBinary(f)) {
    const dest = path.join(outDir, relative(f));
    let content = fs.readFileSync(f, {encoding: "utf-8"});
    substitutions.forEach(([occurrence, replaceWith]) => {
      content = content.replace(occurrence, replaceWith);
    });
    fs.mkdirSync(path.dirname(dest), {recursive: true});
    fs.writeFileSync(dest, content);
  } else {
    const dest = path.join(outDir, relative(f));
    fs.mkdirSync(path.dirname(dest), {recursive: true});
    fs.copyFileSync(f, dest);
  }
}

function main(args) {
  args = fs
    .readFileSync(args[0], {encoding: "utf-8"})
    .split("\n")
    .map(unquoteArgs);

  const [outDir, srcsArg, substitutionsArg, stampFilePath] = args;

  const substitutions = Object.entries(normalizeSubstitutions(substitutionsArg, stampFilePath));
  const sources = new Set(srcsArg.split(','));

  for (const f of sources) {
    copyWithReplace(f, outDir, substitutions);
  }
  return 0;
}

if (require.main === module) {
  process.exitCode = main(process.argv.slice(2));
}
