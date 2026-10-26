#!/usr/bin/env node
// Lists specs that build their database through the MongoDB-only testing module without saying
// whether they should also run on PostgreSQL. A spec is classified once it runs through
// contractSuite (both engines) or declares mongoOnly("reason").
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const SCANNED_ROOTS = ["packages", "apps"];
const SKIPPED_DIRECTORIES = new Set(["node_modules", "dist"]);

const MONGO_MODULE = /DatabaseTestingModule\s*\.\s*(replicaSet|standalone|create|connect)\s*\(/;
const CLASSIFIED = /\b(contractSuite|mongoOnly)\s*\(/;

export function findUnclassifiedSpecs(root) {
  const unclassified = [];
  for (const scanned of SCANNED_ROOTS) {
    walk(path.join(root, scanned), file => {
      if (!file.endsWith(".spec.ts")) return;
      const text = fs.readFileSync(file, "utf8");
      if (MONGO_MODULE.test(text) && !CLASSIFIED.test(text)) {
        unclassified.push(path.relative(root, file).split(path.sep).join("/"));
      }
    });
  }
  return unclassified.sort();
}

function walk(directory, visit) {
  if (!fs.existsSync(directory)) return;
  for (const entry of fs.readdirSync(directory, {withFileTypes: true})) {
    if (SKIPPED_DIRECTORIES.has(entry.name)) continue;
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(full, visit);
    else visit(full);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) == fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const strict = process.argv.includes("--strict");
  const prefix = process.argv.find(arg => arg.startsWith("--under="))?.slice("--under=".length);

  const specs = findUnclassifiedSpecs(root).filter(spec => !prefix || spec.startsWith(prefix));
  for (const spec of specs) {
    console.log(spec);
  }
  console.log(
    `\n${specs.length} spec(s) use the MongoDB testing module without contractSuite or mongoOnly.`
  );
  if (strict && specs.length) {
    process.exit(1);
  }
}
