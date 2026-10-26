import fs from "fs";
import os from "os";
import path from "path";
import {Npm} from "@spica-server/function-pkgmanager-node";
import {LocalPackageManager} from "@spica-server/function-pkgmanager-local";
import {FunctionDependents} from "@spica-server/function/src/function-dependents";

describe("FunctionDependents", () => {
  let root: string;
  let fns: {_id: string; name: string; language: string}[];
  let functionService: {findSummaries: jest.Mock};
  let builders: Map<string, {bundlesDependencies: boolean}>;
  let preparationService: {build: jest.Mock};
  let dependents: FunctionDependents;

  // Writes a function's package.json; each import is a sibling function name or an explicit
  // `file:` path relative to the function's directory.
  const addFunction = async (
    name: string,
    imports: string[] = [],
    extra: Record<string, string> = {}
  ) => {
    fns.push({_id: `${name}_id`, name, language: "typescript"});
    const dependencies = {...extra};
    for (const imported of imports) {
      dependencies[`@spica-fn/${imported}`] = imported.startsWith("file:")
        ? imported
        : `file:../${imported}`;
    }
    await fs.promises.mkdir(path.join(root, name), {recursive: true});
    await fs.promises.writeFile(
      path.join(root, name, "package.json"),
      JSON.stringify({name, dependencies})
    );
  };

  const find = (name: string) => dependents.find(fns.find(fn => fn.name == name) as any);
  const names = async (name: string) => (await find(name)).map(fn => fn.name);

  beforeEach(async () => {
    root = await fs.promises.mkdtemp(path.join(os.tmpdir(), "fn-dependents-"));
    fns = [];
    functionService = {findSummaries: jest.fn().mockImplementation(async () => fns)};
    builders = new Map([["typescript", {bundlesDependencies: false}]]);
    preparationService = {build: jest.fn().mockResolvedValue(undefined)};
    const scheduler = {
      pkgmanagers: new Map([["node", new LocalPackageManager(new Npm())]]),
      builders
    };
    dependents = new FunctionDependents(
      functionService as any,
      scheduler as any,
      {root, timeout: 1, outDir: ".build"},
      preparationService as any
    );
  });

  afterEach(() => fs.promises.rm(root, {recursive: true, force: true}));

  it("should only read names and languages from the database", async () => {
    await addFunction("x");
    await find("x");
    expect(functionService.findSummaries).toHaveBeenCalledTimes(1);
  });

  it("should find direct and indirect importers", async () => {
    await addFunction("x");
    await addFunction("a", ["x"]);
    await addFunction("b", ["a"]);
    await addFunction("unrelated");

    expect(await names("x")).toEqual(["a", "b"]);
    expect(await names("a")).toEqual(["b"]);
    expect(await names("b")).toEqual([]);
  });

  it("should return each importer once in a diamond", async () => {
    await addFunction("x");
    await addFunction("a", ["x"]);
    await addFunction("b", ["x"]);
    await addFunction("c", ["a", "b"]);

    const found = await names("x");
    expect(found.sort()).toEqual(["a", "b", "c"]);
  });

  it("should order every function after the functions it imports", async () => {
    await addFunction("b", ["x", "a"]);
    await addFunction("a", ["x"]);
    await addFunction("x");

    expect(await names("x")).toEqual(["a", "b"]);
  });

  it("should terminate on import cycles and exclude the saved function", async () => {
    await addFunction("x", ["b"]);
    await addFunction("a", ["x"]);
    await addFunction("b", ["a"]);

    expect((await names("x")).sort()).toEqual(["a", "b"]);
  });

  it("should ignore registry packages, unknown folders and missing package.json files", async () => {
    await addFunction("x");
    await addFunction("a", ["file:../not-a-function"], {lodash: "^4.17.21"});
    fns.push({_id: "no_pkg_id", name: "no-pkg", language: "typescript"});

    expect(await names("x")).toEqual([]);
  });

  it("should resolve the imported function from the file path, not the package name", async () => {
    await addFunction("x");
    await addFunction("custom-path");
    await addFunction("a", ["file:../custom-path"]);

    expect(await names("custom-path")).toEqual(["a"]);
    expect(await names("x")).toEqual([]);
  });

  it("should skip a function whose package.json is not valid json", async () => {
    await addFunction("x");
    await addFunction("a", ["x"]);
    await addFunction("broken");
    await fs.promises.writeFile(path.join(root, "broken", "package.json"), "{");

    expect(await names("x")).toEqual(["a"]);
  });

  describe("refreshPlan", () => {
    it("should outdate and reconcile the function together with its importers", async () => {
      await addFunction("x");
      await addFunction("a", ["x"]);
      await addFunction("b", ["a"]);

      const plan = await dependents.refreshPlan(fns[0] as any);

      expect(plan).toEqual({
        routing: [],
        outdate: ["x_id", "a_id", "b_id"],
        reconcile: ["x_id", "a_id", "b_id"]
      });
    });

    it("should not rebuild importers when the builder does not bundle dependencies", async () => {
      await addFunction("x");
      await addFunction("a", ["x"]);

      await dependents.refreshPlan(fns[0] as any);

      expect(preparationService.build).not.toHaveBeenCalled();
    });

    it("should rebuild importers in import order when the builder bundles dependencies", async () => {
      builders.set("typescript", {bundlesDependencies: true});
      await addFunction("x");
      await addFunction("b", ["x", "a"]);
      await addFunction("a", ["x"]);

      await dependents.refreshPlan(fns[0] as any);

      expect(preparationService.build.mock.calls.map(([fn]) => fn.name)).toEqual(["a", "b"]);
    });

    it("should still outdate an importer whose rebuild fails", async () => {
      builders.set("typescript", {bundlesDependencies: true});
      preparationService.build.mockRejectedValue(new Error("syntax error"));
      await addFunction("x");
      await addFunction("a", ["x"]);

      const plan = await dependents.refreshPlan(fns[0] as any);

      expect(plan.outdate).toEqual(["x_id", "a_id"]);
    });
  });
});
