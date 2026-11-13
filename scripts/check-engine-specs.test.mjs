import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {afterEach, beforeEach, describe, it} from "node:test";
import {findUnclassifiedSpecs} from "./check-engine-specs.mjs";

describe("findUnclassifiedSpecs", () => {
  let root;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "engine-specs-"));
  });

  afterEach(() => fs.rmSync(root, {recursive: true, force: true}));

  function write(file, content) {
    const full = path.join(root, file);
    fs.mkdirSync(path.dirname(full), {recursive: true});
    fs.writeFileSync(full, content);
  }

  it("should report specs that only use the MongoDB testing module", () => {
    write("packages/a/test/a.spec.ts", `imports: [DatabaseTestingModule.replicaSet()]`);
    write("packages/b/test/b.spec.ts", `imports: [DatabaseTestingModule.standalone("x")]`);

    assert.deepEqual(findUnclassifiedSpecs(root), [
      "packages/a/test/a.spec.ts",
      "packages/b/test/b.spec.ts"
    ]);
  });

  it("should accept contractSuite and mongoOnly specs", () => {
    write(
      "packages/a/test/a.spec.ts",
      `contractSuite("a", engine => { imports: [engine.module()] }); DatabaseTestingModule.replicaSet()`
    );
    write(
      "packages/b/test/b.spec.ts",
      `mongoOnly("asserts the command shape"); DatabaseTestingModule.replicaSet()`
    );

    assert.deepEqual(findUnclassifiedSpecs(root), []);
  });

  it("should ignore specs without the testing module, non-specs and node_modules", () => {
    write("packages/a/test/a.spec.ts", `describe("pure", () => {})`);
    write("packages/a/src/a.ts", `DatabaseTestingModule.replicaSet()`);
    write("packages/node_modules/x/x.spec.ts", `DatabaseTestingModule.replicaSet()`);

    assert.deepEqual(findUnclassifiedSpecs(root), []);
  });
});
