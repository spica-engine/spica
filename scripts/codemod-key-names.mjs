#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import ts from "typescript";

const KEY = "_id";
const DATA_PACKAGE = "@spica-server/data";
const SYSTEM_RECORDS = /^packages\/interface\/(?!database\/)/;
const MAX_PASSES = 8;

export function transform({
  root,
  rootNames,
  options,
  only = [""],
  anyIsSystem = [],
  systemRecords = SYSTEM_RECORDS
}) {
  const overlay = new Map();
  const cache = new Map();
  const rewritten = [];
  let manual = [];
  let oldProgram;

  for (let pass = 0; pass < MAX_PASSES; pass++) {
    const program = createProgram(rootNames.map(toPosix), options, overlay, cache, oldProgram);
    oldProgram = program;
    const context = {
      root: toPosix(root),
      checker: program.getTypeChecker(),
      systemRecords,
      anyIsSystem
    };

    const changes = new Map();
    manual = [];
    for (const sourceFile of program.getSourceFiles()) {
      const relative = relativeTo(context.root, sourceFile.fileName);
      if (
        sourceFile.isDeclarationFile ||
        relative.startsWith("..") ||
        relative.includes("node_modules/") ||
        !only.some(prefix => relative.startsWith(prefix))
      ) {
        continue;
      }
      const result = analyze(sourceFile, relative, context);
      manual.push(...result.manual);
      if (result.edits.length) {
        changes.set(toPosix(sourceFile.fileName), applyEdits(sourceFile, result.edits));
        rewritten.push(...result.edits.map(({line, kind}) => ({file: relative, line, kind})));
      }
    }

    if (!changes.size) {
      break;
    }
    for (const [file, text] of changes) {
      overlay.set(file, text);
    }
  }

  return {files: overlay, rewritten, manual};
}

function createProgram(rootNames, options, overlay, cache, oldProgram) {
  const host = ts.createCompilerHost(options, true);
  const read = host.readFile.bind(host);

  host.readFile = fileName => overlay.get(toPosix(fileName)) ?? read(fileName);
  host.getSourceFile = (fileName, languageVersion) => {
    const key = toPosix(fileName);
    const text = overlay.get(key);
    const hit = cache.get(key);
    if (hit && (text === undefined || hit.text === text)) {
      return hit.sourceFile;
    }
    const content = text ?? read(fileName);
    if (content === undefined) {
      return undefined;
    }
    const sourceFile = ts.createSourceFile(fileName, content, languageVersion, true);
    cache.set(key, {text: content, sourceFile});
    return sourceFile;
  };

  return ts.createProgram({rootNames, options, host, oldProgram});
}

function analyze(sourceFile, relative, {root, checker, systemRecords, anyIsSystem}) {
  const edits = [];
  const manual = [];
  const anyAllowed = anyIsSystem.some(prefix => relative.startsWith(prefix));

  const lineOf = node => sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
  const report = (node, kind) =>
    manual.push({
      file: relative,
      line: lineOf(node),
      kind,
      text: node.getText().split("\n")[0].slice(0, 100)
    });

  const isSystemSymbol = symbol =>
    Boolean(
      symbol?.declarations?.some(declaration =>
        systemRecords.test(relativeTo(root, declaration.getSourceFile().fileName))
      )
    );

  const edit = (node, text, name, kind) =>
    edits.push({start: node.getStart(), end: node.getEnd(), text, name, kind, line: lineOf(node)});

  const readKey = node => {
    const parent = node.parent;
    if (ts.isDeleteExpression(parent)) {
      return report(node, "delete");
    }
    if (
      ts.isBinaryExpression(parent) &&
      parent.left === node &&
      parent.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
      parent.operatorToken.kind <= ts.SyntaxKind.LastAssignment
    ) {
      return report(node, "assignment");
    }

    const symbol = checker.getSymbolAtLocation(node.name);
    const untyped =
      !symbol && (checker.getTypeAtLocation(node.expression).flags & ts.TypeFlags.Any) != 0;
    if (!(isSystemSymbol(symbol) || (untyped && anyAllowed))) {
      return report(node, untyped ? "untyped receiver" : "not a system record");
    }

    const receiver = node.expression.getText();
    if (!ts.isOptionalChain(node)) {
      return edit(node, `idOf(${receiver})`, "idOf", "read");
    }
    const continues =
      (ts.isPropertyAccessExpression(parent) ||
        ts.isElementAccessExpression(parent) ||
        ts.isCallExpression(parent)) &&
      parent.expression === node;
    if (node.questionDotToken && !continues && isSideEffectFree(node.expression)) {
      return edit(node, `(${receiver} ? idOf(${receiver}) : undefined)`, "idOf", "optional read");
    }
    report(node, "optional chain");
  };

  const literal = node => {
    const keyed = node.properties.filter(isKeyProperty);
    if (!keyed.length) {
      return;
    }
    const property = keyed[0];
    const contextual = checker.getContextualType(node);
    const system =
      contextual &&
      isSystemSymbol(checker.getPropertyOfType(checker.getNonNullableType(contextual), KEY));
    const later = node.properties.slice(node.properties.indexOf(property) + 1);

    if (keyed.length > 1 || later.some(ts.isSpreadAssignment)) {
      return report(property, "object literal with a spread after the key");
    }
    if (!system) {
      return report(property, "object literal");
    }
    const others = node.properties
      .filter(other => other !== property)
      .map(other => other.getText());
    const value = ts.isShorthandPropertyAssignment(property) ? KEY : property.initializer.getText();
    edit(node, `withId({${others.join(", ")}}, ${value})`, "withId", "literal");
  };

  const visit = node => {
    if (ts.isPropertyAccessExpression(node) && node.name.text == KEY) {
      readKey(node);
    } else if (ts.isObjectLiteralExpression(node)) {
      literal(node);
    } else if (ts.isBindingElement(node) && isKeyName(node.propertyName ?? node.name)) {
      report(node, "destructuring");
    } else if (
      ts.isElementAccessExpression(node) &&
      ts.isStringLiteralLike(node.argumentExpression) &&
      node.argumentExpression.text == KEY
    ) {
      report(node, "element access");
    } else if (
      (ts.isPropertySignature(node) || ts.isPropertyDeclaration(node)) &&
      isKeyName(node.name)
    ) {
      report(node, "declaration");
    } else if (ts.isStringLiteralLike(node) && node.text == KEY && isFreeString(node)) {
      report(node, "string");
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);

  const kept = edits.filter(
    outer =>
      !edits.some(inner => inner !== outer && inner.start >= outer.start && inner.end <= outer.end)
  );
  return {edits: kept, manual};
}

function applyEdits(sourceFile, edits) {
  const all = [...edits, ...importEdits(sourceFile, new Set(edits.map(({name}) => name)))];
  let text = sourceFile.text;
  for (const {start, end, text: replacement} of all.sort((a, b) => b.start - a.start)) {
    text = text.slice(0, start) + replacement + text.slice(end);
  }
  return text;
}

function importEdits(sourceFile, needed) {
  const imports = sourceFile.statements.filter(ts.isImportDeclaration);
  const existing = imports.find(
    declaration =>
      declaration.moduleSpecifier.text == DATA_PACKAGE &&
      !declaration.importClause?.isTypeOnly &&
      declaration.importClause?.namedBindings &&
      ts.isNamedImports(declaration.importClause.namedBindings)
  );

  if (existing) {
    const bindings = existing.importClause.namedBindings;
    const present = new Set(bindings.elements.map(element => element.name.text));
    const missing = [...needed].filter(name => !present.has(name));
    if (!missing.length) {
      return [];
    }
    const names = [...bindings.elements.map(element => element.getText()), ...missing];
    return [{start: bindings.getStart(), end: bindings.getEnd(), text: `{${names.join(", ")}}`}];
  }

  const statement = `import {${[...needed].join(", ")}} from "${DATA_PACKAGE}";`;
  if (!imports.length) {
    return [{start: 0, end: 0, text: `${statement}\n`}];
  }
  const position = imports.at(-1).getEnd();
  return [{start: position, end: position, text: `\n${statement}`}];
}

function isKeyName(name) {
  return (
    Boolean(name) && (ts.isIdentifier(name) || ts.isStringLiteralLike(name)) && name.text == KEY
  );
}

function isKeyProperty(property) {
  return (
    (ts.isPropertyAssignment(property) || ts.isShorthandPropertyAssignment(property)) &&
    isKeyName(property.name)
  );
}

function isFreeString(node) {
  const parent = node.parent;
  return !(
    (ts.isElementAccessExpression(parent) && parent.argumentExpression === node) ||
    (ts.isPropertyAssignment(parent) && parent.name === node) ||
    (ts.isPropertySignature(parent) && parent.name === node) ||
    ts.isImportDeclaration(parent) ||
    ts.isExportDeclaration(parent)
  );
}

function isSideEffectFree(expression) {
  if (ts.isIdentifier(expression) || expression.kind == ts.SyntaxKind.ThisKeyword) {
    return true;
  }
  return ts.isPropertyAccessExpression(expression) && isSideEffectFree(expression.expression);
}

const realPaths = new Map();

function realPath(file) {
  if (!realPaths.has(file)) {
    const existing = fs.existsSync(file) ? fs.realpathSync(file) : file;
    realPaths.set(file, existing);
  }
  return realPaths.get(file);
}

function relativeTo(root, file) {
  return slashes(path.relative(realPath(root), realPath(file)));
}

function slashes(file) {
  return file.split(path.sep).join("/");
}

function toPosix(file) {
  return slashes(path.resolve(file));
}

function readProject(root, project) {
  const configPath = path.resolve(root, project);
  const config = ts.readConfigFile(configPath, ts.sys.readFile);
  if (config.error) {
    throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, "\n"));
  }
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, path.dirname(configPath));
  return {fileNames: parsed.fileNames, options: parsed.options};
}

function option(argv, name) {
  return argv.filter(arg => arg.startsWith(`--${name}=`)).map(arg => arg.slice(name.length + 3));
}

export function run(root, argv, log = console.log) {
  const projects = option(argv, "project");
  if (!projects.length) {
    log(
      "Usage: node scripts/codemod-key-names.mjs --project=<tsconfig> [--project=...] " +
        "[--only=<path>/] [--any-is-system=<path>/] [--write]"
    );
    return 1;
  }

  const parsed = projects.map(project => readProject(root, project));
  const rootNames = [...new Set(parsed.flatMap(({fileNames}) => fileNames))];
  const options = {
    ...parsed[0].options,
    noEmit: true,
    composite: false,
    incremental: false,
    declaration: false
  };
  const only = option(argv, "only");

  const result = transform({
    root,
    rootNames,
    options,
    only: only.length ? only : projects.map(project => `${path.dirname(project)}/`),
    anyIsSystem: option(argv, "any-is-system")
  });

  for (const [kind, entries] of groupBy(result.rewritten, entry => entry.kind)) {
    log(`rewrote ${entries.length} ${kind}(s)`);
  }
  for (const [kind, entries] of groupBy(result.manual, entry => entry.kind)) {
    log(`\nmanual: ${kind} (${entries.length})`);
    for (const {file, line, text} of entries) {
      log(`  ${file}:${line}  ${text}`);
    }
  }

  const files = [...result.files.keys()].map(file => relativeTo(root, file));
  if (!argv.includes("--write")) {
    log(`\nDry run: ${files.length} file(s) would change. Pass --write to apply.`);
    return 0;
  }
  for (const [file, text] of result.files) {
    fs.writeFileSync(file, text);
  }
  log(`\nWrote ${files.length} file(s). Format only these, then fix the types by hand:`);
  log(`  npx prettier --write ${files.join(" ")}`);
  log(`  yarn nx sync`);
  return 0;
}

function groupBy(entries, key) {
  const groups = new Map();
  for (const entry of entries) {
    groups.set(key(entry), [...(groups.get(key(entry)) ?? []), entry]);
  }
  return groups;
}

if (process.argv[1] && path.resolve(process.argv[1]) == fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  process.exit(run(root, process.argv.slice(2)));
}
