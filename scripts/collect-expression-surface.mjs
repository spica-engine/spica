#!/usr/bin/env node
/**
 * Expression surface inventory.
 *
 * Answers two questions by measurement rather than by guesswork:
 *   1. Which operators and builtins must Spica's expression language (CEL) support?
 *   2. How wide is the surface through which a raw Mongo JSON filter reaches the outside?
 *
 * It produces no estimates; it only scans the code base. Output: docs/expression-surface.md
 */
import fs from "fs";
import path from "path";
import {fileURLToPath} from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCAN = ["packages", "apps"];
const SKIP = new Set(["node_modules", "dist", ".nx", ".git", "coverage", "tmp"]);

const MONGO_QUERY_OPS = new Set([
  "eq",
  "ne",
  "gt",
  "gte",
  "lt",
  "lte",
  "in",
  "nin",
  "and",
  "or",
  "nor",
  "not",
  "exists",
  "type",
  "regex",
  "options",
  "expr",
  "jsonSchema",
  "mod",
  "text",
  "where",
  "all",
  "elemMatch",
  "size",
  "bitsAllClear",
  "bitsAllSet",
  "bitsAnyClear",
  "bitsAnySet",
  "geoWithin",
  "geoIntersects",
  "near",
  "nearSphere",
  "slice",
  "comment",
  "rand"
]);
const MONGO_UPDATE_OPS = new Set([
  "set",
  "unset",
  "inc",
  "mul",
  "rename",
  "min",
  "max",
  "currentDate",
  "setOnInsert",
  "push",
  "pop",
  "pull",
  "pullAll",
  "addToSet",
  "each",
  "position",
  "sort",
  "bit"
]);
const MONGO_AGG_STAGES = new Set([
  "match",
  "project",
  "group",
  "sort",
  "limit",
  "skip",
  "unwind",
  "lookup",
  "facet",
  "count",
  "addFields",
  "replaceWith",
  "replaceRoot",
  "set",
  "out",
  "merge",
  "sample",
  "sortByCount",
  "bucket",
  "bucketAuto",
  "graphLookup",
  "redact",
  "unionWith",
  "densify",
  "fill",
  "search"
]);

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    if (SKIP.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".d.ts")) out.push(full);
  }
  return out;
}

const isSpec = f =>
  /\.spec\.ts$/.test(f) ||
  `${path.sep}test${path.sep}` ===
    f.slice(f.indexOf(`${path.sep}test${path.sep}`), f.indexOf(`${path.sep}test${path.sep}`) + 6);
const rel = f => path.relative(ROOT, f);

const files = SCAN.flatMap(d => walk(path.join(ROOT, d)));

// ---- 1. Mongo operator inventory -------------------------------------------
const ops = new Map(); // name -> {src:Set, spec:Set}
const OP_RE = /(?:["'`]\$([a-zA-Z][a-zA-Z0-9]*)["'`]|[{,]\s*\$([a-zA-Z][a-zA-Z0-9]*)\s*:)/g;

for (const f of files) {
  const text = fs.readFileSync(f, "utf8");
  const spec = /\.spec\.ts$/.test(f) || f.includes(`${path.sep}test${path.sep}`);
  for (const m of text.matchAll(OP_RE)) {
    const name = m[1] || m[2];
    if (!ops.has(name)) ops.set(name, {src: new Set(), spec: new Set()});
    ops.get(name)[spec ? "spec" : "src"].add(rel(f));
  }
}

// ---- 2. Entry points for a raw Mongo JSON filter ---------------------------
const entryPoints = [];
const ENTRY_RE = /@Query\(\s*"filter"[^)]*\)/g;

/**
 * The pipe list between `@Query("filter",` and the closing parenthesis at end of line. Scanned rather
 * than matched: the argument nests parentheses, so a lazy group anchored at the end backtracks
 * super-linearly.
 */
const extractPipes = line => {
  const open = line.indexOf('@Query(');
  if (open === -1) return undefined;
  const comma = line.indexOf(",", open);
  const close = line.lastIndexOf(")");
  if (comma === -1 || close <= comma) return undefined;
  if (line.slice(open + "@Query(".length, comma).trim() !== '"filter"') return undefined;
  if (line.slice(close + 1).trim() !== "") return undefined;
  return line.slice(comma + 1, close).trim() || undefined;
};
for (const f of files) {
  if (/\.spec\.ts$/.test(f) || f.includes(`${path.sep}test${path.sep}`)) continue;
  const lines = fs.readFileSync(f, "utf8").split("\n");
  lines.forEach((line, i) => {
    if (ENTRY_RE.test(line)) {
      ENTRY_RE.lastIndex = 0;
      const pipes = extractPipes(line) ?? line.trim();
      entryPoints.push({file: rel(f), line: i + 1, pipes});
    }
    if (/from ["']mingo["']|require\(["']mingo["']\)/.test(line)) {
      entryPoints.push({file: rel(f), line: i + 1, pipes: "mingo (in-memory Mongo matcher)"});
    }
  });
}

// ---- 3. CEL surface ----------------------------------------------------------
const exprDir = path.join(ROOT, "packages/api/bucket/expression/src");
const indexTs = fs.readFileSync(path.join(exprDir, "index.ts"), "utf8");
const builtins = [...indexTs.matchAll(/func\.register\(\s*"([^"]+)"/g)].map(m => m[1]);

const grammar = fs.readFileSync(path.join(exprDir, "grammar.pegjs"), "utf8");
const grabOps = label => {
  const m = grammar.match(new RegExp(`${label}\\s*=[^\\n]*type:\\(([^)]*)\\)`));
  return m ? [...m[1].matchAll(/"([^"]+)"/g)].map(x => x[1]) : [];
};
const celOperators = {
  relation: grabOps("RelationOperation"),
  addition: grabOps("AdditionOperation"),
  multiplication: grabOps("MultiplicationOperation"),
  logical: ["&&", "||", "!"],
  other: ["?:", ".", "[]", "()"]
};

// ---- report ------------------------------------------------------------------
const bucketOf = n =>
  MONGO_QUERY_OPS.has(n)
    ? "query"
    : MONGO_UPDATE_OPS.has(n)
      ? "update"
      : MONGO_AGG_STAGES.has(n)
        ? "stage"
        : "other";

const sorted = [...ops.entries()].sort(
  (a, b) => b[1].src.size - a[1].src.size || a[0].localeCompare(b[0])
);

const table = kind =>
  sorted
    .filter(([n]) => bucketOf(n) === kind)
    .map(
      ([n, v]) =>
        `| \`$${n}\` | ${v.src.size} | ${v.spec.size} | ${[...v.src].slice(0, 3).join("<br>") || "—"} |`
    )
    .join("\n") || "| — | | | |";

const report = `# Expression surface inventory

> Generated by \`scripts/collect-expression-surface.mjs\` — do not edit by hand.
> Generated: ${new Date().toISOString().slice(0, 10)} · Files scanned: ${files.length}

This report answers two questions by measurement: what the expression contract has to cover, and how
wide the raw Mongo JSON filter surface actually is.

## 1. Spica expression language (CEL) — the current surface

Source: \`packages/api/bucket/expression/\`. This language is **canonical**; the PG driver compiles it.

**Registered builtin functions (${builtins.length}):** ${builtins.map(b => `\`${b}\``).join(", ")}

**Grammar operators:**

| Class | Operators |
|---|---|
| Comparison | ${celOperators.relation.map(o => `\`${o}\``).join(" ") || "—"} |
| Arithmetic | ${[...celOperators.addition, ...celOperators.multiplication].map(o => `\`${o}\``).join(" ") || "—"} |
| Logical | ${celOperators.logical.map(o => `\`${o}\``).join(" ")} |
| Other | ${celOperators.other.map(o => `\`${o}\``).join(" ")} |

## 2. Entry points for a raw Mongo JSON filter (${entryPoints.length})

The cost side: these endpoints either answer 400 on PG, or are lowered to CEL.

| File | Line | Pipe / note |
|---|---|---|
${entryPoints.map(e => `| \`${e.file}\` | ${e.line} | \`${e.pipes.replaceAll("|", "\\|")}\` |`).join("\n")}

## 3. Mongo operator inventory

\`src\` = production code, \`spec\` = tests. An operator that appears only in specs is not thereby
unpromised to the outside (\`?filter=\` accepts free-form JSON) — but it does set the priority.

### Query operators

| Operator | src | spec | example files |
|---|---|---|---|
${table("query")}

### Update operators

| Operator | src | spec | example files |
|---|---|---|---|
${table("update")}

### Aggregation stages

| Stage | src | spec | example files |
|---|---|---|---|
${table("stage")}

### Unclassified \`$\` tokens

Mostly aggregation expressions (\`$toLong\`, \`$ifNull\`…) or false positives (template variables).

${
  sorted
    .filter(([n]) => bucketOf(n) === "other")
    .map(([n, v]) => `\`$${n}\`(${v.src.size})`)
    .join(" · ") || "—"
}
`;

const out = path.join(ROOT, "docs/expression-surface.md");
fs.writeFileSync(out, report);
console.log(`✓ wrote ${rel(out)}`);
console.log(`  files scanned      : ${files.length}`);
console.log(`  CEL builtins       : ${builtins.length}`);
console.log(`  Mongo JSON entries : ${entryPoints.length}`);
console.log(`  distinct $ tokens  : ${ops.size}`);
