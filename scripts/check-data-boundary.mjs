#!/usr/bin/env node
// Fails when code outside the MongoDB adapter reaches MongoDB directly. Everything outside the
// adapter has to go through @spica-server/data and @spica-server/interface-data so that another
// database engine can be bound without touching callers.
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const SCANNED_ROOTS = ["packages", "apps"];

const EXEMPT_PREFIXES = [
  "packages/data/mongodb/",
  "packages/data/postgresql/",
  "packages/database/",
  "packages/interface/database/",
  "packages/devkit/",
  "apps/migrate/",
  "apps/panel/",
  "apps/mongoreplicationcontroller/"
];

const SKIPPED_DIRECTORIES = new Set(["node_modules", "dist", "test", "testing"]);

const ADAPTER_REGISTRATION = "apps/api/src/main.ts";

const REALTIME_PACKAGE = "@spica-server/database-realtime";
const REALTIME_EXPORTS = new Set(["RealtimeDatabaseService", "RealtimeDatabaseModule"]);

const FORBIDDEN_IDENTIFIERS = ["ObjectId", "DatabaseService", "BaseCollection"];

/**
 * Known violations that later parts of the PostgreSQL work remove. Each entry names the file, the
 * forbidden import or identifier, and the part that owns it.
 */
export const ALLOWLIST = [
  {
    file: "packages/api/bucket/expression/src/builtin_funcs.ts",
    match: ["@spica-server/database", "ObjectId"],
    reason: "ACL rules render to MongoDB filters with ObjectIds (Part 7)"
  },
  {
    file: "packages/api/bucket/expression/src/convert.ts",
    match: ["@spica-server/database", "ObjectId"],
    reason: "ACL rules render to MongoDB filters with ObjectIds (Part 7)"
  },
  {
    file: "packages/api/bucket/graphql/src/schema.ts",
    match: ["@spica-server/database", "ObjectId"],
    reason: "GraphQL where arguments render to MongoDB filters (Part 8)"
  },
  {
    file: "packages/api/storage/src/body.ts",
    match: ["bson"],
    reason: "application/bson is a request body format of the storage API, not database access"
  }
];

export function checkDataBoundary(root, {allowlist = ALLOWLIST} = {}) {
  const violations = [];
  for (const scanned of SCANNED_ROOTS) {
    const directory = path.join(root, scanned);
    if (fs.existsSync(directory)) {
      for (const file of sourceFiles(root, directory)) {
        violations.push(...checkFile(root, file));
      }
    }
  }
  return violations.filter(
    violation =>
      !allowlist.some(
        entry => entry.file == violation.file && entry.match.includes(violation.subject)
      )
  );
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
    } else if (isSource(entry.name)) {
      yield full;
    }
  }
}

function isSource(name) {
  return (
    name.endsWith(".ts") &&
    !name.endsWith(".d.ts") &&
    !name.endsWith(".spec.ts") &&
    !name.startsWith("jest.config.")
  );
}

function checkFile(root, file) {
  const relative = toPosix(path.relative(root, file));
  const text = fs.readFileSync(file, "utf8");
  const violations = [];
  const report = (index, subject, message) =>
    violations.push({file: relative, line: lineOf(text, index), subject, message});

  for (const {specifier, names, index} of imports(text)) {
    if (isMongoDriver(specifier)) {
      report(index, specifier, `imports "${specifier}"`);
    } else if (specifier == REALTIME_PACKAGE) {
      const others = names.filter(name => !REALTIME_EXPORTS.has(name));
      if (!names.length || others.length) {
        report(index, specifier, `imports ${others.join(", ") || "*"} from "${specifier}"`);
      }
    } else if (specifier.startsWith("@spica-server/database")) {
      report(index, specifier, `imports "${specifier}"`);
    } else if (
      (specifier == "@spica-server/data-mongodb" || specifier == "@spica-server/data-postgresql") &&
      relative != ADAPTER_REGISTRATION
    ) {
      report(index, specifier, `imports "${specifier}" outside ${ADAPTER_REGISTRATION}`);
    }
  }

  const code = stripCommentsAndStrings(text);
  for (const identifier of FORBIDDEN_IDENTIFIERS) {
    // Object keys such as the GraphQL scalar named ObjectId only reuse the name.
    const pattern = new RegExp(`(?<![\\w$.])${identifier}(?![\\w$]|\\s*:(?!:))`, "g");
    for (const match of code.matchAll(pattern)) {
      report(match.index, identifier, `uses ${identifier}`);
    }
  }

  return violations;
}

function isMongoDriver(specifier) {
  return ["mongodb", "bson", "pg"].some(name => specifier == name || specifier.startsWith(name + "/"));
}

const IMPORT_PATTERNS = [
  /\b(?:import|export)\s+(type\s+)?([\w$\s{},*]*?)\s*\bfrom\s*["']([^"']+)["']/g,
  /\bimport\s*["']([^"']+)["']/g,
  /\b(?:import|require)\s*\(\s*["']([^"']+)["']\s*\)/g
];

function imports(text) {
  const code = stripComments(text);
  const found = [];
  for (const match of code.matchAll(IMPORT_PATTERNS[0])) {
    found.push({specifier: match[3], names: importedNames(match[2]), index: match.index});
  }
  for (const pattern of IMPORT_PATTERNS.slice(1)) {
    for (const match of code.matchAll(pattern)) {
      found.push({specifier: match[1], names: [], index: match.index});
    }
  }
  return found;
}

function importedNames(clause) {
  const braces = clause.match(/\{([^}]*)\}/);
  if (!braces) {
    return [];
  }
  return braces[1]
    .split(",")
    .map(
      part =>
        part
          .trim()
          .replace(/^type\s+/, "")
          .split(/\s+as\s+/)[0]
    )
    .filter(Boolean);
}

function stripComments(text) {
  return scan(text, {keepStrings: true});
}

function stripCommentsAndStrings(text) {
  return scan(text, {keepStrings: false});
}

// Blanks comments (and optionally string, template and regex literal contents) while keeping
// offsets intact, so matches can be reported with the line of the original text.
function scan(text, {keepStrings}) {
  let output = "";
  let i = 0;
  const templateDepths = [];
  let braceDepth = 0;
  const blank = chunk => chunk.replace(/[^\n]/g, " ");
  const literal = chunk =>
    keepStrings ? chunk : chunk[0] + blank(chunk.slice(1, -1)) + chunk.at(-1);

  while (i < text.length) {
    const char = text[i];
    const next = text[i + 1];

    if (char == "/" && next == "/") {
      const end = text.indexOf("\n", i);
      const stop = end == -1 ? text.length : end;
      output += blank(text.slice(i, stop));
      i = stop;
    } else if (char == "/" && next == "*") {
      const end = text.indexOf("*/", i + 2);
      const stop = end == -1 ? text.length : end + 2;
      output += blank(text.slice(i, stop));
      i = stop;
    } else if (char == '"' || char == "'") {
      const stop = endOfQuoted(text, i, char);
      output += literal(text.slice(i, stop));
      i = stop;
    } else if (char == "`" || (char == "}" && templateDepths.at(-1) == braceDepth)) {
      if (char == "}") {
        templateDepths.pop();
      }
      const {stop, opensExpression} = endOfTemplateChunk(text, i);
      const chunk = text.slice(i, stop);
      output += keepStrings
        ? chunk
        : chunk[0] +
          blank(chunk.slice(1, opensExpression ? -2 : -1)) +
          (opensExpression ? "${" : chunk.at(-1));
      if (opensExpression) {
        templateDepths.push(braceDepth);
      }
      i = stop;
    } else if (char == "/" && startsRegex(output)) {
      const stop = endOfRegex(text, i);
      output += literal(text.slice(i, stop));
      i = stop;
    } else {
      if (char == "{") {
        braceDepth++;
      } else if (char == "}") {
        braceDepth--;
      }
      output += char;
      i++;
    }
  }
  return output;
}

function endOfQuoted(text, start, quote) {
  let i = start + 1;
  while (i < text.length && text[i] != quote && text[i] != "\n") {
    i += text[i] == "\\" ? 2 : 1;
  }
  return Math.min(i + 1, text.length);
}

function endOfTemplateChunk(text, start) {
  let i = start + 1;
  while (i < text.length) {
    if (text[i] == "\\") {
      i += 2;
    } else if (text[i] == "`") {
      return {stop: i + 1, opensExpression: false};
    } else if (text[i] == "$" && text[i + 1] == "{") {
      return {stop: i + 2, opensExpression: true};
    } else {
      i++;
    }
  }
  return {stop: text.length, opensExpression: false};
}

function startsRegex(preceding) {
  const trimmed = preceding.trimEnd();
  const previous = trimmed.at(-1);
  return (
    previous == undefined ||
    "(,=:[!&|?{};+-*%<>~^".includes(previous) ||
    /(?<![\w$])(?:return|typeof|case|in|of|new|delete|void|throw|yield|await)$/.test(trimmed)
  );
}

function endOfRegex(text, start) {
  let i = start + 1;
  let inClass = false;
  while (i < text.length && text[i] != "\n") {
    if (text[i] == "\\") {
      i += 2;
      continue;
    }
    if (text[i] == "[") {
      inClass = true;
    } else if (text[i] == "]") {
      inClass = false;
    } else if (text[i] == "/" && !inClass) {
      i++;
      while (/[a-z]/i.test(text[i] || "")) {
        i++;
      }
      return i;
    }
    i++;
  }
  return i;
}

function lineOf(text, index) {
  let line = 1;
  for (let i = 0; i < index; i++) {
    if (text[i] == "\n") {
      line++;
    }
  }
  return line;
}

function toPosix(file) {
  return file.split(path.sep).join("/");
}

if (process.argv[1] && path.resolve(process.argv[1]) == fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const violations = checkDataBoundary(root);
  for (const violation of violations) {
    console.error(`${violation.file}:${violation.line}: ${violation.message}`);
  }
  if (violations.length) {
    console.error(
      `\n${violations.length} data boundary violation(s). Go through @spica-server/data and ` +
        `@spica-server/interface-data instead, or move the code into packages/data/mongodb.`
    );
    process.exit(1);
  }
  console.log("Data boundary check passed.");
}
