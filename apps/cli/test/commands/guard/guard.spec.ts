import {mkdirSync, mkdtempSync, realpathSync, rmSync} from "node:fs";
import os, {tmpdir} from "node:os";
import {join} from "node:path";
import {guard} from "../../../src/guard";

describe("guard", () => {
  let home: string;
  let project: string;
  let originalCwd: string;

  beforeEach(() => {
    originalCwd = process.cwd();
    home = realpathSync(mkdtempSync(join(tmpdir(), "spica-cli-guard-home-")));
    project = realpathSync(mkdtempSync(join(tmpdir(), "spica-cli-guard-project-")));
    jest.spyOn(os, "homedir").mockReturnValue(home);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    jest.restoreAllMocks();
    rmSync(home, {recursive: true, force: true});
    rmSync(project, {recursive: true, force: true});
  });

  it("should not restrict when no guard is set", () => {
    expect(guard.load()).toBeUndefined();
    expect(() => guard.assert(originalCwd)).not.toThrow();
  });

  it("should save, load and remove the guard", () => {
    guard.save({path: project, folders: ["bucket"]});
    expect(guard.load()).toEqual({path: project, folders: ["bucket"]});
    expect(guard.remove()).toBe(true);
    expect(guard.load()).toBeUndefined();
    expect(guard.remove()).toBe(false);
  });

  it("should throw when run outside of the guarded directory", () => {
    guard.save({path: project, folders: []});
    process.chdir(home);

    expect(() => guard.assert(home)).toThrow(`Invalid working directory: "${home}"`);
  });

  it("should throw when the dir argument points outside of the guarded directory", () => {
    guard.save({path: project, folders: []});
    process.chdir(project);

    expect(() => guard.assert(home)).toThrow(`Invalid working directory: "${home}"`);
  });

  it("should throw when a required folder is missing", () => {
    mkdirSync(join(project, "bucket"));
    guard.save({path: project, folders: ["bucket", "function"]});
    process.chdir(project);

    expect(() => guard.assert(project)).toThrow("Missing required folder(s): function.");
  });

  it("should pass when run from the guarded directory with all folders present", () => {
    mkdirSync(join(project, "bucket"));
    mkdirSync(join(project, "function"));
    guard.save({path: project, folders: ["bucket", "function"]});
    process.chdir(project);

    expect(() => guard.assert(project)).not.toThrow();
  });
});
