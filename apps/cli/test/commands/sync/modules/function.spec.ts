import os from "os";
import path from "path";
import fs from "fs";
import yaml from "yaml";
import {functionModule} from "@spica/cli/src/commands/sync/modules/function";

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "spica-fn-test-"));
}

function cleanup(dir: string) {
  fs.rmSync(dir, {recursive: true, force: true});
}

const mockHttp = {
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn()
} as any;

beforeEach(() => jest.clearAllMocks());

describe("functionModule.readLocal", () => {
  it("returns empty when function dir does not exist", async () => {
    const dir = makeTmpDir();
    try {
      expect(await functionModule.readLocal(dir)).toEqual([]);
    } finally {
      cleanup(dir);
    }
  });

  it("reads schema, index.mjs, and package.json", async () => {
    const dir = makeTmpDir();
    try {
      const fnDir = path.join(dir, "function", "MyFn");
      fs.mkdirSync(fnDir, {recursive: true});
      fs.writeFileSync(
        path.join(fnDir, "schema.yaml"),
        yaml.stringify({name: "MyFn", language: "javascript", triggers: {}})
      );
      fs.writeFileSync(path.join(fnDir, "index.mjs"), "export default () => {};");
      fs.writeFileSync(
        path.join(fnDir, "package.json"),
        JSON.stringify({name: "MyFn", dependencies: {"lodash": "^4.0.0"}})
      );

      const result = await functionModule.readLocal(dir);
      expect(result).toHaveLength(1);
      expect(result[0].slug).toBe("MyFn");
      expect(result[0].data.index).toBe("export default () => {};");
      expect(result[0].data.dependencies).toEqual({"lodash": "^4.0.0"});
    } finally {
      cleanup(dir);
    }
  });

  it("uses index.ts for typescript functions", async () => {
    const dir = makeTmpDir();
    try {
      const fnDir = path.join(dir, "function", "TsFn");
      fs.mkdirSync(fnDir, {recursive: true});
      fs.writeFileSync(
        path.join(fnDir, "schema.yaml"),
        yaml.stringify({name: "TsFn", language: "typescript"})
      );
      fs.writeFileSync(path.join(fnDir, "index.ts"), "const x: number = 1;");

      const result = await functionModule.readLocal(dir);
      expect(result[0].data.index).toBe("const x: number = 1;");
    } finally {
      cleanup(dir);
    }
  });

  it("treats missing package.json as empty dependencies", async () => {
    const dir = makeTmpDir();
    try {
      const fnDir = path.join(dir, "function", "NoDeps");
      fs.mkdirSync(fnDir, {recursive: true});
      fs.writeFileSync(
        path.join(fnDir, "schema.yaml"),
        yaml.stringify({name: "NoDeps", language: "javascript"})
      );
      fs.writeFileSync(path.join(fnDir, "index.mjs"), "");

      const result = await functionModule.readLocal(dir);
      expect(result[0].data.dependencies).toEqual({});
    } finally {
      cleanup(dir);
    }
  });
});

describe("functionModule.readRemote", () => {
  it("fetches schema, index, and dependencies for each function", async () => {
    mockHttp.get.mockImplementation((url: string) => {
      if (url === "function") return Promise.resolve([{_id: "fn1", name: "MyFn", language: "javascript"}]);
      if (url === "function/fn1/index") return Promise.resolve({index: "export default () => {};"});
      if (url === "function/fn1/dependencies") return Promise.resolve([{name: "lodash", version: "^4.0.0"}]);
      return Promise.resolve([]);
    });

    const result = await functionModule.readRemote(mockHttp);
    expect(result).toHaveLength(1);
    expect(result[0].slug).toBe("MyFn");
    expect(result[0].data.index).toBe("export default () => {};");
    expect(result[0].data.dependencies).toEqual({lodash: "^4.0.0"});
  });
});

describe("functionModule.create", () => {
  it("POSTs schema, then index, then dependencies", async () => {
    mockHttp.post.mockImplementation((url: string) => {
      if (url === "function") return Promise.resolve({_id: "new-id"});
      return Promise.resolve({});
    });

    await functionModule.create(mockHttp, {
      slug: "MyFn",
      data: {
        schema: {name: "MyFn", language: "javascript"},
        index: "export default () => {};",
        dependencies: {"lodash": "4.17.21"}
      }
    });

    expect(mockHttp.post).toHaveBeenNthCalledWith(1, "function", expect.objectContaining({name: "MyFn"}));
    expect(mockHttp.post).toHaveBeenNthCalledWith(2, "function/new-id/index", {index: "export default () => {};"});
    expect(mockHttp.post).toHaveBeenNthCalledWith(3, "function/new-id/dependencies", {name: ["lodash@4.17.21"]});
  });

  it("skips dependencies POST when there are no dependencies", async () => {
    mockHttp.post.mockImplementation((url: string) => {
      if (url === "function") return Promise.resolve({_id: "new-id"});
      return Promise.resolve({});
    });

    await functionModule.create(mockHttp, {
      slug: "NoDeps",
      data: {
        schema: {name: "NoDeps", language: "javascript"},
        index: "",
        dependencies: {}
      }
    });

    expect(mockHttp.post).toHaveBeenCalledTimes(2); // schema + index only
  });
});

describe("functionModule.update", () => {
  it("PUTs schema and POSTs index", async () => {
    mockHttp.put.mockResolvedValue({});
    mockHttp.post.mockResolvedValue({});
    mockHttp.get.mockResolvedValue([]); // no existing deps

    await functionModule.update(mockHttp, {
      slug: "MyFn",
      data: {
        schema: {name: "MyFn"},
        index: "updated code",
        dependencies: {}
      }
    }, "fn-id");

    expect(mockHttp.put).toHaveBeenCalledWith("function/fn-id", {name: "MyFn"});
    expect(mockHttp.post).toHaveBeenCalledWith("function/fn-id/index", {index: "updated code"});
  });

  it("deletes removed dependencies and adds new ones", async () => {
    mockHttp.put.mockResolvedValue({});
    mockHttp.post.mockResolvedValue({});
    mockHttp.delete.mockResolvedValue({});
    mockHttp.get.mockResolvedValue([
      {name: "old-pkg", version: "^1.0.0"},
      {name: "keep-pkg", version: "^2.0.0"}
    ]);

    await functionModule.update(mockHttp, {
      slug: "MyFn",
      data: {
        schema: {name: "MyFn"},
        index: "",
        dependencies: {"keep-pkg": "^2.0.0", "new-pkg": "^3.0.0"}
      }
    }, "fn-id");

    expect(mockHttp.delete).toHaveBeenCalledWith("function/fn-id/dependencies/old-pkg");
    expect(mockHttp.post).toHaveBeenCalledWith("function/fn-id/dependencies", {name: ["new-pkg@3.0.0"]});
  });
});

describe("functionModule.writeLocal", () => {
  it("creates schema.yaml, index.mjs, and package.json", async () => {
    const dir = makeTmpDir();
    try {
      await functionModule.writeLocal(dir, {
        slug: "MyFn",
        id: "fn1",
        data: {
          schema: {_id: "fn1", name: "MyFn", language: "javascript"},
          index: "export default () => {};",
          dependencies: {}
        }
      });

      const fnDir = path.join(dir, "function", "MyFn");
      expect(fs.existsSync(path.join(fnDir, "schema.yaml"))).toBe(true);
      expect(fs.existsSync(path.join(fnDir, "index.mjs"))).toBe(true);
      expect(fs.existsSync(path.join(fnDir, "package.json"))).toBe(true);

      const index = fs.readFileSync(path.join(fnDir, "index.mjs"), "utf-8");
      expect(index).toBe("export default () => {};");
    } finally {
      cleanup(dir);
    }
  });
});

describe("functionModule.diffFields", () => {
  it("returns 'schema' when schema differs", () => {
    const changed = functionModule.diffFields(
      {schema: {name: "f", timeout: 30}, index: "", dependencies: {}},
      {schema: {name: "f", timeout: 60}, index: "", dependencies: {}}
    );
    expect(changed).toContain("schema");
  });

  it("returns 'index' when code differs", () => {
    const changed = functionModule.diffFields(
      {schema: {name: "f"}, index: "new code", dependencies: {}},
      {schema: {name: "f"}, index: "old code", dependencies: {}}
    );
    expect(changed).toContain("index");
  });

  it("returns 'dependencies' when deps differ", () => {
    const changed = functionModule.diffFields(
      {schema: {name: "f"}, index: "", dependencies: {lodash: "^4.0.0"}},
      {schema: {name: "f"}, index: "", dependencies: {}}
    );
    expect(changed).toContain("dependencies");
  });

  it("returns empty when everything matches", () => {
    const data = {schema: {name: "f"}, index: "x", dependencies: {lodash: "^4"}};
    const changed = functionModule.diffFields(data, data);
    expect(changed).toEqual([]);
  });
});
