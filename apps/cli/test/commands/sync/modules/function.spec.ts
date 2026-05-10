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
  it("POSTs schema without env_vars, then index, then dependencies", async () => {
    mockHttp.post.mockImplementation((url: string) => {
      if (url === "function") return Promise.resolve({_id: "new-id"});
      return Promise.resolve({});
    });
    mockHttp.put.mockResolvedValue({});

    await functionModule.create(mockHttp, {
      slug: "MyFn",
      data: {
        schema: {name: "MyFn", language: "javascript"},
        index: "export default () => {};",
        dependencies: {"lodash": "4.17.21"}
      }
    });

    const schemaCall = mockHttp.post.mock.calls[0];
    expect(schemaCall[0]).toBe("function");
    expect(schemaCall[1]).not.toHaveProperty("env_vars");
    expect(mockHttp.post).toHaveBeenCalledWith("function/new-id/index", {index: "export default () => {};"});
    expect(mockHttp.post).toHaveBeenCalledWith("function/new-id/dependencies", {name: ["lodash@4.17.21"]});
  });

  it("injects env_vars via PUT after create", async () => {
    mockHttp.post.mockImplementation((url: string) => {
      if (url === "function") return Promise.resolve({_id: "new-id"});
      return Promise.resolve({});
    });
    mockHttp.put.mockResolvedValue({});

    await functionModule.create(mockHttp, {
      slug: "MyFn",
      data: {
        schema: {name: "MyFn", language: "javascript", env_vars: ["ev-1", "ev-2"]},
        index: "",
        dependencies: {}
      }
    });

    expect(mockHttp.put).toHaveBeenCalledWith("function/new-id/env-var/ev-1", {});
    expect(mockHttp.put).toHaveBeenCalledWith("function/new-id/env-var/ev-2", {});
  });

  it("injects secrets via PUT after create", async () => {
    mockHttp.post.mockImplementation((url: string) => {
      if (url === "function") return Promise.resolve({_id: "new-id"});
      return Promise.resolve({});
    });
    mockHttp.put.mockResolvedValue({});

    await functionModule.create(mockHttp, {
      slug: "MyFn",
      data: {
        schema: {name: "MyFn", language: "javascript", secrets: ["sec-1", "sec-2"]},
        index: "",
        dependencies: {}
      }
    });

    expect(mockHttp.put).toHaveBeenCalledWith("function/new-id/secret/sec-1", {});
    expect(mockHttp.put).toHaveBeenCalledWith("function/new-id/secret/sec-2", {});
  });

  it("skips dependencies POST when there are no dependencies", async () => {
    mockHttp.post.mockImplementation((url: string) => {
      if (url === "function") return Promise.resolve({_id: "new-id"});
      return Promise.resolve({});
    });
    mockHttp.put.mockResolvedValue({});

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
  it("PUTs schema without env_vars and POSTs index", async () => {
    mockHttp.put.mockResolvedValue({});
    mockHttp.post.mockResolvedValue({});
    mockHttp.get.mockImplementation((url: string) => {
      if (url === "function/fn-id") return Promise.resolve({_id: "fn-id", name: "MyFn", env_vars: []});
      return Promise.resolve([]);
    });

    await functionModule.update(mockHttp, {
      slug: "MyFn",
      data: {
        schema: {name: "MyFn"},
        index: "updated code",
        dependencies: {}
      }
    }, "fn-id");

    const putSchemaCall = mockHttp.put.mock.calls.find((c: any[]) => c[0] === "function/fn-id");
    expect(putSchemaCall).toBeDefined();
    expect(putSchemaCall[1]).not.toHaveProperty("env_vars");
    expect(putSchemaCall[1]).not.toHaveProperty("secrets");
    expect(mockHttp.post).toHaveBeenCalledWith("function/fn-id/index", {index: "updated code"});
  });

  it("injects newly added env_vars and ejects removed ones", async () => {
    mockHttp.put.mockResolvedValue({});
    mockHttp.post.mockResolvedValue({});
    mockHttp.delete.mockResolvedValue({});
    mockHttp.get.mockImplementation((url: string) => {
      if (url === "function/fn-id") return Promise.resolve({_id: "fn-id", name: "MyFn", env_vars: ["ev-old", "ev-keep"]});
      return Promise.resolve([]); // dependencies
    });

    await functionModule.update(mockHttp, {
      slug: "MyFn",
      data: {
        schema: {name: "MyFn", env_vars: ["ev-keep", "ev-new"]},
        index: "",
        dependencies: {}
      }
    }, "fn-id");

    expect(mockHttp.put).toHaveBeenCalledWith("function/fn-id/env-var/ev-new", {});
    expect(mockHttp.delete).toHaveBeenCalledWith("function/fn-id/env-var/ev-old");
    expect(mockHttp.put).not.toHaveBeenCalledWith("function/fn-id/env-var/ev-keep", {});
  });

  it("injects newly added secrets and ejects removed ones", async () => {
    mockHttp.put.mockResolvedValue({});
    mockHttp.post.mockResolvedValue({});
    mockHttp.delete.mockResolvedValue({});
    mockHttp.get.mockImplementation((url: string) => {
      if (url === "function/fn-id") return Promise.resolve({_id: "fn-id", name: "MyFn", env_vars: [], secrets: ["sec-old", "sec-keep"]});
      return Promise.resolve([]); // dependencies
    });

    await functionModule.update(mockHttp, {
      slug: "MyFn",
      data: {
        schema: {name: "MyFn", secrets: ["sec-keep", "sec-new"]},
        index: "",
        dependencies: {}
      }
    }, "fn-id");

    expect(mockHttp.put).toHaveBeenCalledWith("function/fn-id/secret/sec-new", {});
    expect(mockHttp.delete).toHaveBeenCalledWith("function/fn-id/secret/sec-old");
    expect(mockHttp.put).not.toHaveBeenCalledWith("function/fn-id/secret/sec-keep", {});
  });

  it("deletes removed dependencies and adds new ones", async () => {
    mockHttp.put.mockResolvedValue({});
    mockHttp.post.mockResolvedValue({});
    mockHttp.delete.mockResolvedValue({});
    mockHttp.get.mockImplementation((url: string) => {
      if (url === "function/fn-id") return Promise.resolve({_id: "fn-id", name: "MyFn", env_vars: []});
      return Promise.resolve([
        {name: "old-pkg", version: "^1.0.0"},
        {name: "keep-pkg", version: "^2.0.0"}
      ]);
    });

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

  it("returns 'env_vars' when env_vars differ", () => {
    const changed = functionModule.diffFields(
      {schema: {name: "f", env_vars: ["ev-1", "ev-2"]}, index: "", dependencies: {}},
      {schema: {name: "f", env_vars: ["ev-1"]}, index: "", dependencies: {}}
    );
    expect(changed).toContain("env_vars");
  });

  it("does not flag env_vars change as schema change", () => {
    const changed = functionModule.diffFields(
      {schema: {name: "f", env_vars: ["ev-1"]}, index: "", dependencies: {}},
      {schema: {name: "f", env_vars: ["ev-2"]}, index: "", dependencies: {}}
    );
    expect(changed).not.toContain("schema");
    expect(changed).toContain("env_vars");
  });

  it("returns 'secrets' when secrets differ", () => {
    const changed = functionModule.diffFields(
      {schema: {name: "f", secrets: ["sec-1", "sec-2"]}, index: "", dependencies: {}},
      {schema: {name: "f", secrets: ["sec-1"]}, index: "", dependencies: {}}
    );
    expect(changed).toContain("secrets");
  });

  it("does not flag secrets change as schema change", () => {
    const changed = functionModule.diffFields(
      {schema: {name: "f", secrets: ["sec-1"]}, index: "", dependencies: {}},
      {schema: {name: "f", secrets: ["sec-2"]}, index: "", dependencies: {}}
    );
    expect(changed).not.toContain("schema");
    expect(changed).toContain("secrets");
  });

  it("returns empty when everything matches", () => {
    const data = {schema: {name: "f"}, index: "x", dependencies: {lodash: "^4"}};
    const changed = functionModule.diffFields(data, data);
    expect(changed).toEqual([]);
  });
});
