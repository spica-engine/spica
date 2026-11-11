#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {stripComments} from "./check-data-boundary.mjs";

const SCANNED_ROOTS = ["packages", "apps"];

const EXEMPT_PREFIXES = [
  "packages/data/mongodb/",
  "packages/devkit/database/",
  "packages/devkit/testing/",
  "apps/migrate/",
  "apps/mongoreplicationcontroller/",
  "apps/panel/"
];

const SKIPPED_DIRECTORIES = new Set(["node_modules", "dist", "fixtures", ".nx", "coverage"]);

const IGNORED_JSON = /(^|\/)(package|project|tsconfig[\w.-]*|jest[\w.-]*)\.json$/;

const KEY_LITERAL = /(?<![\w$])_id(?![\w$])/g;

export const BASELINE_FILE = "scripts/key-names-baseline.json";

export function countKeyLiterals(root) {
  const counts = {};
  for (const scanned of SCANNED_ROOTS) {
    const directory = path.join(root, scanned);
    if (!fs.existsSync(directory)) {
      continue;
    }
    for (const file of sourceFiles(root, directory)) {
      const relative = toPosix(path.relative(root, file));
      const text = fs.readFileSync(file, "utf8");
      const code = file.endsWith(".json") ? text : stripComments(text);
      const count = (code.match(KEY_LITERAL) || []).length;
      if (count) {
        counts[relative] = count;
      }
    }
  }
  return counts;
}

export function checkKeyNames(root, baseline, {strictUnder} = {}) {
  const counts = countKeyLiterals(root);

  if (strictUnder) {
    return {
      grown: Object.entries(counts)
        .filter(([file]) => file.startsWith(strictUnder))
        .map(([file, count]) => ({file, count, allowed: 0})),
      shrunk: []
    };
  }

  const grown = [];
  const shrunk = [];
  for (const file of new Set([...Object.keys(counts), ...Object.keys(baseline)])) {
    const count = counts[file] ?? 0;
    const allowed = baseline[file] ?? 0;
    if (count > allowed) {
      grown.push({file, count, allowed});
    } else if (count < allowed) {
      shrunk.push({file, count, allowed});
    }
  }
  return {grown, shrunk, counts};
}

export function readBaseline(root) {
  const file = path.join(root, BASELINE_FILE);
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : {};
}

export function writeBaseline(root, counts) {
  const sorted = Object.fromEntries(Object.entries(counts).sort(([a], [b]) => (a < b ? -1 : 1)));
  const file = path.join(root, BASELINE_FILE);
  fs.mkdirSync(path.dirname(file), {recursive: true});
  fs.writeFileSync(file, JSON.stringify(sorted, null, 2) + "\n");
}

function* sourceFiles(root, directory) {
  for (const entry of fs.readdirSync(directory, {withFileTypes: true})) {
    const full = path.join(directory, entry.name);
    const relative = toPosix(path.relative(root, full));
    if (EXEMPT_PREFIXES.some(prefix => (relative + "/").startsWith(prefix))) {
      continue;
    }
    if (entry.isDirectory()) {
      if (!SKIPPED_DIRECTORIES.has(entry.name)) {
        yield* sourceFiles(root, full);
      }
    } else if (isScanned(entry.name)) {
      yield full;
    }
  }
}

function isScanned(name) {
  if (name.endsWith(".json")) {
    return !IGNORED_JSON.test(name);
  }
  return name.endsWith(".ts") && !name.endsWith(".d.ts");
}

function toPosix(file) {
  return file.split(path.sep).join("/");
}

export function run(root, argv) {
  const strict = argv.includes("--strict");
  const under = argv.find(arg => arg.startsWith("--under="))?.slice("--under=".length);
  if (strict && !under) {
    console.error("--strict needs --under=<path>/");
    return 1;
  }

  const baseline = readBaseline(root);
  const {grown, shrunk, counts} = checkKeyNames(root, baseline, {
    strictUnder: strict ? under : undefined
  });

  if (argv.includes("--update") && !fs.existsSync(path.join(root, BASELINE_FILE))) {
    writeBaseline(root, counts);
    console.log(`Baseline created for ${Object.keys(counts).length} file(s).`);
    return 0;
  }

  for (const {file, count, allowed} of grown) {
    console.error(`${file}: ${count} "_id" literal(s), ${allowed} allowed`);
  }
  if (grown.length) {
    console.error(
      `\n${grown.length} file(s) name the key literally. Use ids().systemKeyField(), idOf, ` +
        `withId and omitId from @spica-server/data (documentKey for bucket documents) instead.`
    );
    return 1;
  }

  if (strict) {
    console.log(`No "_id" literals under ${under}.`);
    return 0;
  }

  if (argv.includes("--update")) {
    writeBaseline(root, counts);
    console.log(`Baseline updated (${shrunk.length} file(s) lowered).`);
    return 0;
  }

  for (const {file, count, allowed} of shrunk) {
    console.error(`${file}: ${count} "_id" literal(s), baseline says ${allowed}`);
  }
  if (shrunk.length) {
    console.error(`\nThe baseline is out of date. Run: yarn check:key-names --update`);
    return 1;
  }

  console.log("Key name check passed.");
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) == fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  process.exit(run(root, process.argv.slice(2)));
}
