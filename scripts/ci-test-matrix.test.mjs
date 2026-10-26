import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {afterEach, beforeEach, describe, it} from "node:test";
import {buildMatrix, specNeeds} from "./ci-test-matrix.mjs";

describe("specNeeds", () => {
  it("should detect each service from what a spec references", () => {
    assert.deepEqual(specNeeds(`import {DatabaseTestingModule} from "@spica-server/database-testing";`), {
      mongodb: true,
      postgresql: false,
      rabbitmq: false,
      mailer: false
    });
    assert.equal(specNeeds(`process.env.RABBITMQ_URL`).rabbitmq, true);
    assert.equal(specNeeds(`process.env.RABBITMQ_STREAM_HOST`).rabbitmq, true);
    assert.equal(specNeeds(`process.env.MAILER_URL`).mailer, true);
  });

  it("should need both databases for a contract suite", () => {
    const needs = specNeeds(
      `import {contractSuite} from "@spica-server/database-testing"; contractSuite("x", () => {})`
    );
    assert.equal(needs.mongodb, true);
    assert.equal(needs.postgresql, true);
  });

  it("should need nothing for a spec that touches no service", () => {
    assert.deepEqual(specNeeds(`describe("pure", () => {})`), {
      mongodb: false,
      postgresql: false,
      rabbitmq: false,
      mailer: false
    });
  });
});

describe("buildMatrix", () => {
  let root;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "ci-matrix-"));
    execFileSync("git", ["init", "-q"], {cwd: root});
  });

  afterEach(() => fs.rmSync(root, {recursive: true, force: true}));

  function write(file, content) {
    const full = path.join(root, file);
    fs.mkdirSync(path.dirname(full), {recursive: true});
    fs.writeFileSync(full, content);
    execFileSync("git", ["add", "-f", file], {cwd: root});
  }

  const project = (name, directory) =>
    write(`${directory}/project.json`, JSON.stringify({name}));

  it("should union the needs of a project's specs", () => {
    project("a", "packages/a");
    write("packages/a/test/one.spec.ts", `database-testing`);
    write("packages/a/test/two.spec.ts", `process.env.MAILER_URL`);

    assert.deepEqual(buildMatrix(root, ["a"]), [
      {project: "a", mongodb: true, postgresql: false, rabbitmq: false, mailer: true}
    ]);
  });

  it("should not count specs of a nested project for its parent", () => {
    project("parent", "packages/parent");
    project("parent/child", "packages/parent/child");
    write("packages/parent/test/p.spec.ts", `describe("pure", () => {})`);
    write("packages/parent/child/test/c.spec.ts", `database-testing`);

    assert.deepEqual(
      buildMatrix(root, ["parent", "parent/child"]).map(({project, mongodb}) => [project, mongodb]),
      [
        ["parent", false],
        ["parent/child", true]
      ]
    );
  });

  it("should need every service for a project it can not find", () => {
    assert.deepEqual(buildMatrix(root, ["ghost"]), [
      {project: "ghost", mongodb: true, postgresql: true, rabbitmq: true, mailer: true}
    ]);
  });
});
