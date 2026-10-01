#!/usr/bin/env node
/**
 * Faz 0 / Faz 3 adım 1 — ifade yüzeyi envanteri.
 *
 * İki soruyu ölçerek cevaplar:
 *   1. K-4: Spica ifade dilinin (CEL) desteklemesi gereken operatör/builtin kümesi nedir?
 *   2. AK-6: Ham Mongo JSON filtresi dışarıya ne kadar geniş bir yüzeyden sızıyor?
 *
 * Tahmin üretmez; yalnız kod tabanını tarar. Çıktı: docs/expression-surface.md
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

// ---- 1. Mongo operatör envanteri -------------------------------------------
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

// ---- 2. Ham Mongo JSON filtresinin giriş noktaları ---------------------------
const entryPoints = [];
const ENTRY_RE = /@Query\(\s*"filter"[^)]*\)/g;
for (const f of files) {
  if (/\.spec\.ts$/.test(f) || f.includes(`${path.sep}test${path.sep}`)) continue;
  const lines = fs.readFileSync(f, "utf8").split("\n");
  lines.forEach((line, i) => {
    if (ENTRY_RE.test(line)) {
      ENTRY_RE.lastIndex = 0;
      const pipes = line.match(/@Query\(\s*"filter",\s*(.+?)\)\s*$/)?.[1] ?? line.trim();
      entryPoints.push({file: rel(f), line: i + 1, pipes});
    }
    if (/from ["']mingo["']|require\(["']mingo["']\)/.test(line)) {
      entryPoints.push({file: rel(f), line: i + 1, pipes: "mingo (bellek içi Mongo eşleyici)"});
    }
  });
}

// ---- 3. CEL yüzeyi ----------------------------------------------------------
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

// ---- rapor ------------------------------------------------------------------
const bucketOf = n =>
  MONGO_QUERY_OPS.has(n)
    ? "query"
    : MONGO_UPDATE_OPS.has(n)
      ? "update"
      : MONGO_AGG_STAGES.has(n)
        ? "stage"
        : "diğer";

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

const report = `# İfade yüzeyi envanteri

> \`scripts/collect-expression-surface.mjs\` tarafından üretildi — elle düzenlenmez.
> Üretim tarihi: ${new Date().toISOString().slice(0, 10)} · Taranan dosya: ${files.length}

Bu rapor iki soruya ölçümle cevap verir: **K-4**'ün ifade sözleşmesi neyi kapsamalı, ve
**AK-6** için ham Mongo JSON filtresinin yüzeyi gerçekte ne kadar geniş.

## 1. Spica ifade dili (CEL) — mevcut yüzey

Kaynak: \`packages/api/bucket/expression/\`. Bu dil **kanonik** (K-3); PG sürücüsü bunu derleyecek.

**Kayıtlı builtin fonksiyonlar (${builtins.length}):** ${builtins.map(b => `\`${b}\``).join(", ")}

**Gramer operatörleri:**

| Sınıf | Operatörler |
|---|---|
| Karşılaştırma | ${celOperators.relation.map(o => `\`${o}\``).join(" ") || "—"} |
| Aritmetik | ${[...celOperators.addition, ...celOperators.multiplication].map(o => `\`${o}\``).join(" ") || "—"} |
| Mantıksal | ${celOperators.logical.map(o => `\`${o}\``).join(" ")} |
| Diğer | ${celOperators.other.map(o => `\`${o}\``).join(" ")} |

## 2. Ham Mongo JSON filtresinin giriş noktaları (${entryPoints.length})

AK-6'nın maliyet tarafı: bu uçlar PG'de 400 dönecek ya da CEL'e indirilecek.

| Dosya | Satır | Pipe / not |
|---|---|---|
${entryPoints.map(e => `| \`${e.file}\` | ${e.line} | \`${e.pipes.replace(/\|/g, "\\|")}\` |`).join("\n")}

## 3. Mongo operatör envanteri

\`src\` = üretim kodu, \`spec\` = test. Bir operatörün yalnız spec'te geçmesi, dışarıya vaat
edilmediği anlamına gelmez (\`?filter=\` serbest JSON kabul ediyor) — ama önceliği belirler.

### Sorgu operatörleri

| Operatör | src | spec | örnek dosyalar |
|---|---|---|---|
${table("query")}

### Update operatörleri

| Operatör | src | spec | örnek dosyalar |
|---|---|---|---|
${table("update")}

### Aggregation stage'leri

| Stage | src | spec | örnek dosyalar |
|---|---|---|---|
${table("stage")}

### Sınıflandırılamayan \`$\` token'ları

Çoğu aggregation ifadesi (\`$toLong\`, \`$ifNull\`…) ya da yanlış pozitif (şablon değişkeni).

${
  sorted
    .filter(([n]) => bucketOf(n) === "diğer")
    .map(([n, v]) => `\`$${n}\`(${v.src.size})`)
    .join(" · ") || "—"
}
`;

const out = path.join(ROOT, "docs/expression-surface.md");
fs.writeFileSync(out, report);
console.log(`✓ ${rel(out)} yazıldı`);
console.log(`  taranan dosya      : ${files.length}`);
console.log(`  CEL builtin        : ${builtins.length}`);
console.log(`  Mongo JSON giriş   : ${entryPoints.length}`);
console.log(`  farklı $ token     : ${ops.size}`);
