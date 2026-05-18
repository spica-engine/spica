import os from "os";
import path from "path";
import fs from "fs";
import yaml from "yaml";
import {envVarModule} from "@spica/cli/src/commands/sync/modules/env-var";
import {secretModule} from "@spica/cli/src/commands/sync/modules/secret";
import {policyModule} from "@spica/cli/src/commands/sync/modules/policy";
import {resolveModules} from "@spica/cli/src/commands/sync/modules/index";

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "spica-module-test-"));
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

// ─── Env-var ──────────────────────────────────────────────────────────────────

describe("envVarModule", () => {
  it("reads local env-var files", async () => {
    const dir = makeTmpDir();
    try {
      const envDir = path.join(dir, "env-var", "MY_KEY");
      fs.mkdirSync(envDir, {recursive: true});
      fs.writeFileSync(
        path.join(envDir, "schema.yaml"),
        yaml.stringify({key: "MY_KEY", value: "hello"})
      );

      const result = await envVarModule.readLocal(dir);
      expect(result).toHaveLength(1);
      expect(result[0].slug).toBe("MY_KEY");
      expect(result[0].data.value).toBe("hello");
    } finally {
      cleanup(dir);
    }
  });

  it("reads remote env-vars and uses key as slug", async () => {
    mockHttp.get.mockResolvedValue([{_id: "id1", key: "MY_KEY", value: "v"}]);
    const result = await envVarModule.readRemote(mockHttp);
    expect(result[0]).toMatchObject({slug: "MY_KEY", id: "id1"});
  });

  it("POSTs on create", async () => {
    mockHttp.post.mockResolvedValue({});
    await envVarModule.create(mockHttp, {slug: "MY_KEY", data: {key: "MY_KEY", value: "v"}});
    expect(mockHttp.post).toHaveBeenCalledWith("env-var", {key: "MY_KEY", value: "v"});
  });

  it("PUTs on update", async () => {
    mockHttp.put.mockResolvedValue({});
    await envVarModule.update(mockHttp, {slug: "MY_KEY", data: {key: "MY_KEY", value: "v"}}, "id1");
    expect(mockHttp.put).toHaveBeenCalledWith("env-var/id1", {key: "MY_KEY", value: "v"});
  });

  it("DELETEs on delete", async () => {
    mockHttp.delete.mockResolvedValue({});
    await envVarModule.delete(mockHttp, "id1");
    expect(mockHttp.delete).toHaveBeenCalledWith("env-var/id1");
  });

  it("writes schema.yaml on writeLocal", async () => {
    const dir = makeTmpDir();
    try {
      await envVarModule.writeLocal(dir, {
        slug: "MY_KEY",
        id: "id1",
        data: {key: "MY_KEY", value: "v"}
      });
      const file = path.join(dir, "env-var", "MY_KEY", "schema.yaml");
      expect(fs.existsSync(file)).toBe(true);
    } finally {
      cleanup(dir);
    }
  });

  it("removes dir on deleteLocal", async () => {
    const dir = makeTmpDir();
    try {
      const envDir = path.join(dir, "env-var", "MY_KEY");
      fs.mkdirSync(envDir, {recursive: true});
      await envVarModule.deleteLocal(dir, "MY_KEY");
      expect(fs.existsSync(envDir)).toBe(false);
    } finally {
      cleanup(dir);
    }
  });

  it("detects value changes in diffFields", () => {
    const changed = envVarModule.diffFields({key: "K", value: "old"}, {key: "K", value: "new"});
    expect(changed).toContain("value");
    expect(changed).not.toContain("_id");
  });
});

// ─── Secret ───────────────────────────────────────────────────────────────────

describe("secretModule", () => {
  it("reads local secret files", async () => {
    const dir = makeTmpDir();
    try {
      const secDir = path.join(dir, "secret", "API_KEY");
      fs.mkdirSync(secDir, {recursive: true});
      fs.writeFileSync(
        path.join(secDir, "schema.yaml"),
        yaml.stringify({key: "API_KEY", value: "s3cr3t"})
      );

      const result = await secretModule.readLocal(dir);
      expect(result[0].slug).toBe("API_KEY");
    } finally {
      cleanup(dir);
    }
  });

  it("uses /secret endpoint", async () => {
    mockHttp.get.mockResolvedValue([{_id: "id1", key: "API_KEY", value: "s3cr3t"}]);
    await secretModule.readRemote(mockHttp);
    expect(mockHttp.get).toHaveBeenCalledWith("secret");
  });

  it("DELETEs by id", async () => {
    mockHttp.delete.mockResolvedValue({});
    await secretModule.delete(mockHttp, "id1");
    expect(mockHttp.delete).toHaveBeenCalledWith("secret/id1");
  });

  it("does not flag value as changed when remote omits value (API hides it server-side)", () => {
    const local = {key: "API_KEY", value: "s3cr3t"};
    const remote = {key: "API_KEY"}; // value stripped by server
    const changed = secretModule.diffFields(local, remote);
    expect(changed).not.toContain("value");
    expect(changed).toHaveLength(0);
  });

  it("does not include value in renderDetail diff", () => {
    const local = {slug: "API_KEY", data: {key: "API_KEY", value: "s3cr3t"}};
    const remote = {slug: "API_KEY", id: "id1", data: {key: "API_KEY"}};
    const detail = secretModule.renderDetail(local, remote);
    const diffText = Object.values(detail).join("");
    expect(diffText).not.toContain("s3cr3t");
  });
});

// ─── Policy ───────────────────────────────────────────────────────────────────

describe("policyModule", () => {
  it("reads local policy files", async () => {
    const dir = makeTmpDir();
    try {
      const polDir = path.join(dir, "policy", "Admin Policy");
      fs.mkdirSync(polDir, {recursive: true});
      fs.writeFileSync(
        path.join(polDir, "schema.yaml"),
        yaml.stringify({name: "Admin Policy", statement: []})
      );

      const result = await policyModule.readLocal(dir);
      expect(result[0].slug).toBe("Admin Policy");
    } finally {
      cleanup(dir);
    }
  });

  it("uses /passport/policy endpoint and filters out system policies", async () => {
    mockHttp.get.mockResolvedValue([
      {_id: "id1", name: "User Policy", statement: [], system: false},
      {_id: "id2", name: "System", statement: [], system: true}
    ]);
    const result = await policyModule.readRemote(mockHttp);
    expect(result).toHaveLength(1);
    expect(result[0].slug).toBe("User Policy");
    expect(mockHttp.get).toHaveBeenCalledWith("passport/policy");
  });

  it("filters out system policies when remote returns paginated {data: [...]}", async () => {
    mockHttp.get.mockResolvedValue({
      data: [
        {_id: "id1", name: "User Policy", statement: []},
        {_id: "id2", name: "System", statement: [], system: true}
      ]
    });
    const result = await policyModule.readRemote(mockHttp);
    expect(result).toHaveLength(1);
  });

  it("omits 'system' field on create and update", async () => {
    mockHttp.post.mockResolvedValue({});
    await policyModule.create(mockHttp, {
      slug: "User Policy",
      data: {name: "User Policy", statement: [], system: true} as any
    });
    const body = mockHttp.post.mock.calls[0][1];
    expect(body).not.toHaveProperty("system");
  });

  it("DELETEs by id via passport/policy", async () => {
    mockHttp.delete.mockResolvedValue({});
    await policyModule.delete(mockHttp, "id1");
    expect(mockHttp.delete).toHaveBeenCalledWith("passport/policy/id1");
  });
});

// ─── resolveModules ───────────────────────────────────────────────────────────

describe("resolveModules", () => {
  it("returns all modules when no filter is given", () => {
    const mods = resolveModules();
    expect(mods.length).toBeGreaterThan(0);
  });

  it("deduplicates repeated module names", () => {
    const mods = resolveModules(["bucket", "bucket", "policy"]);
    expect(mods).toHaveLength(2);
    expect(mods.map(m => m.name)).toEqual(["bucket", "policy"]);
  });

  it("throws for unknown module name", () => {
    expect(() => resolveModules(["nonexistent"])).toThrow("Unknown module");
  });
});
