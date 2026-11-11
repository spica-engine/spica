import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {afterEach, beforeEach, describe, it} from "node:test";
import ts from "typescript";
import {run, transform} from "./codemod-key-names.mjs";

const OPTIONS = {
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  strict: true,
  noEmit: true,
  skipLibCheck: true,
  types: []
};

const THING = `export interface Thing {\n  _id?: string;\n  name: string;\n}\n`;

describe("codemod-key-names", () => {
  let root;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "codemod-key-names-"));
    write("packages/interface/thing/src/index.ts", THING);
  });

  afterEach(() => fs.rmSync(root, {recursive: true, force: true}));

  function write(file, content) {
    const full = path.join(root, file);
    fs.mkdirSync(path.dirname(full), {recursive: true});
    fs.writeFileSync(full, content);
  }

  function rewrite(source, options = {}) {
    write("packages/api/thing/src/a.ts", source);
    const result = transform({
      root,
      rootNames: [
        path.join(root, "packages/interface/thing/src/index.ts"),
        path.join(root, "packages/api/thing/src/a.ts")
      ],
      options: OPTIONS,
      only: ["packages/api/"],
      ...options
    });
    const file = path.join(root, "packages/api/thing/src/a.ts");
    return {...result, text: result.files.get(file) ?? source};
  }

  const header = `import {Thing} from "../../../interface/thing/src/index";\n`;

  describe("reads", () => {
    it("should turn a read on a system record into idOf and import it", () => {
      const {text} = rewrite(`${header}export const id = (thing: Thing) => thing._id;\n`);

      assert.equal(
        text,
        `${header}import {idOf} from "@spica-server/data";\nexport const id = (thing: Thing) => idOf(thing);\n`
      );
    });

    it("should keep what is called on the id", () => {
      const {text} = rewrite(
        `${header}export const id = (thing: Thing) => thing._id.toString();\n`
      );

      assert.match(text, /idOf\(thing\)\.toString\(\)/);
    });

    it("should add the helper to an existing import from the data package", () => {
      const {text} = rewrite(
        `${header}import {ids} from "@spica-server/data";\nexport const id = (thing: Thing) => thing._id;\n`
      );

      assert.match(text, /import \{ids, idOf\} from "@spica-server\/data";/);
      assert.equal(text.match(/@spica-server\/data/g).length, 1);
    });

    it("should not import a helper that is already imported", () => {
      const {text} = rewrite(
        `${header}import {idOf} from "@spica-server/data";\nexport const id = (thing: Thing) => thing._id;\n`
      );

      assert.equal(text.match(/@spica-server\/data/g).length, 1);
    });

    it("should rewrite an optional read that ends the chain", () => {
      const {text} = rewrite(`${header}export const id = (thing?: Thing) => thing?._id;\n`);

      assert.match(text, /\(thing \? idOf\(thing\) : undefined\)/);
    });

    it("should leave an optional chain that continues for manual work", () => {
      const {text, manual} = rewrite(
        `${header}export const id = (thing?: Thing) => thing?._id?.toString();\n`
      );

      assert.match(text, /thing\?\._id\?\.toString\(\)/);
      assert.deepEqual(
        manual.map(({kind}) => kind),
        ["optional chain"]
      );
    });

    it("should leave deletes and assignments for manual work", () => {
      const {text, manual} = rewrite(
        `${header}export function f(thing: Thing) {\n  delete thing._id;\n  thing._id = "x";\n}\n`
      );

      assert.doesNotMatch(text, /idOf/);
      assert.deepEqual(
        manual.map(({kind}) => kind),
        ["delete", "assignment"]
      );
    });

    it("should not touch a property that is not declared by a system record", () => {
      const {text, manual} = rewrite(
        `export interface Other { _id: string }\nexport const id = (other: Other) => other._id;\n`
      );

      assert.doesNotMatch(text, /idOf/);
      assert.deepEqual(
        manual.map(({kind}) => kind),
        ["declaration", "not a system record"]
      );
    });

    it("should report an untyped receiver, and rewrite it where it is declared system-only", () => {
      const source = `export const id = (body: any) => body._id;\n`;

      assert.deepEqual(
        rewrite(source).manual.map(({kind}) => kind),
        ["untyped receiver"]
      );
      assert.match(rewrite(source, {anyIsSystem: ["packages/api/thing/"]}).text, /idOf\(body\)/);
    });

    it("should not touch files outside the requested paths", () => {
      const {files} = rewrite(`${header}export const id = (thing: Thing) => thing._id;\n`, {
        only: ["packages/api/elsewhere/"]
      });

      assert.equal(files.size, 0);
    });
  });

  describe("object literals", () => {
    it("should turn a literal typed as a system record into withId", () => {
      const {text} = rewrite(`${header}export const thing: Thing = {_id: "a", name: "n"};\n`);

      assert.match(text, /export const thing: Thing = withId\(\{name: "n"\}, "a"\);/);
      assert.match(text, /import \{withId\} from "@spica-server\/data";/);
    });

    it("should handle a shorthand key", () => {
      const {text} = rewrite(
        `${header}export const make = (_id: string): Thing => ({_id, name: "n"});\n`
      );

      assert.match(text, /withId\(\{name: "n"\}, _id\)/);
    });

    it("should keep spreads that come before the key", () => {
      const {text} = rewrite(
        `${header}export const make = (rest: Omit<Thing, "_id">): Thing => ({...rest, _id: "a"});\n`
      );

      assert.match(text, /withId\(\{\.\.\.rest\}, "a"\)/);
    });

    it("should leave a spread after the key for manual work", () => {
      const {text, manual} = rewrite(
        `${header}export const make = (rest: Thing): Thing => ({_id: "a", ...rest});\n`
      );

      assert.doesNotMatch(text, /withId/);
      assert.deepEqual(
        manual.map(({kind}) => kind),
        ["object literal with a spread after the key"]
      );
    });

    it("should leave a literal without a system record type for manual work", () => {
      const {text, manual} = rewrite(`export const filter = {_id: {$in: ["a"]}};\n`);

      assert.doesNotMatch(text, /withId/);
      assert.deepEqual(
        manual.map(({kind}) => kind),
        ["object literal"]
      );
    });

    it("should rewrite a read nested inside a rewritten literal", () => {
      const {text} = rewrite(
        `${header}export const copy = (other: Thing): Thing => ({_id: other._id, name: "n"});\n`
      );

      assert.match(text, /withId\(\{name: "n"\}, idOf\(other\)\)/);
      assert.match(text, /import \{withId, idOf\}|import \{idOf, withId\}/);
    });
  });

  describe("other uses", () => {
    it("should only report strings, element access, destructuring and declarations", () => {
      const source =
        `${header}export const IGNORED = ["_id", "name"];\n` +
        `export const read = (thing: Thing) => thing["_id"];\n` +
        `export const pick = ({_id}: Thing) => _id;\n`;
      const {text, manual} = rewrite(source);

      assert.equal(text, source);
      assert.deepEqual(
        manual.map(({kind}) => kind),
        ["string", "element access", "destructuring"]
      );
    });

    it("should report the line of every manual use", () => {
      const {manual} = rewrite(`${header}\nexport const IGNORED = ["_id"];\n`);

      assert.deepEqual(
        manual.map(({file, line}) => `${file}:${line}`),
        ["packages/api/thing/src/a.ts:3"]
      );
    });
  });

  describe("run", () => {
    it("should ask for a project", () => {
      const lines = [];

      assert.equal(
        run(root, [], line => lines.push(line)),
        1
      );
      assert.match(lines.join("\n"), /Usage/);
    });

    it("should leave the files alone unless asked to write", () => {
      const source = `${header}export const id = (thing: Thing) => thing._id;\n`;
      write("packages/api/thing/src/a.ts", source);
      write(
        "packages/api/thing/tsconfig.json",
        JSON.stringify({
          compilerOptions: {
            ...OPTIONS,
            target: "ES2022",
            module: "ESNext",
            moduleResolution: "Bundler"
          },
          include: ["src/**/*.ts", "../../interface/thing/src/**/*.ts"]
        })
      );
      const lines = [];

      assert.equal(
        run(root, ["--project=packages/api/thing/tsconfig.json"], line => lines.push(line)),
        0
      );
      assert.equal(fs.readFileSync(path.join(root, "packages/api/thing/src/a.ts"), "utf8"), source);
      assert.match(lines.join("\n"), /Dry run: 1 file\(s\) would change/);

      run(root, ["--project=packages/api/thing/tsconfig.json", "--write"], line =>
        lines.push(line)
      );
      assert.match(
        fs.readFileSync(path.join(root, "packages/api/thing/src/a.ts"), "utf8"),
        /idOf\(thing\)/
      );
    });
  });
});
