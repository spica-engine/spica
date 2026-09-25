import {
  ALL_MODULES,
  bucketModule,
  buildPlan,
  functionModule,
  memorySource,
  policyModule
} from "@spica-server/sync";

describe("memorySource", () => {
  const source = memorySource({
    "bucket/Users/schema.yaml": "title: Users\n",
    "./bucket/Posts/schema.yaml": "title: Posts\n",
    "bucket\\Windows\\schema.yaml": "title: Windows\n",
    "function/hello/schema.yaml": "name: hello\n",
    "README.md": "root file"
  });

  it("lists immediate child folders of a directory", () => {
    expect(source.listFolders("bucket").sort()).toEqual(["Posts", "Users", "Windows"]);
    expect(source.listFolders("function")).toEqual(["hello"]);
  });

  it("lists top-level folders for an empty root", () => {
    expect(source.listFolders("").sort()).toEqual(["bucket", "function"]);
  });

  it("returns [] for a missing directory", () => {
    expect(source.listFolders("policy")).toEqual([]);
  });

  it("does not treat a folder with a shared prefix as a child", () => {
    const s = memorySource({"bucket-archive/Old/schema.yaml": "title: Old\n"});
    expect(s.listFolders("bucket")).toEqual([]);
  });

  it("reads files by normalized path and returns null when missing", () => {
    expect(source.readText("bucket/Users/schema.yaml")).toBe("title: Users\n");
    expect(source.readText("/bucket/Posts/schema.yaml")).toBe("title: Posts\n");
    expect(source.readText("bucket/Windows/schema.yaml")).toBe("title: Windows\n");
    expect(source.readText("bucket/Missing/schema.yaml")).toBeNull();
  });

  it("accepts a Map", () => {
    const s = memorySource(new Map([["policy/Admin/schema.yaml", "name: Admin\n"]]));
    expect(s.listFolders("policy")).toEqual(["Admin"]);
  });
});

describe("readLocal from a memory source", () => {
  it("reads schema modules", async () => {
    const source = memorySource({
      "bucket/Users/schema.yaml": "title: Users\nproperties: {}\n",
      "bucket/NoSchema/readme.md": "ignored"
    });
    const result = await bucketModule.readLocal("", source);
    expect(result).toEqual([{slug: "Users", data: {title: "Users", properties: {}}}]);
  });

  it("reads functions with index and dependencies", async () => {
    const source = memorySource({
      "function/hello/schema.yaml": "name: hello\nlanguage: typescript\n",
      "function/hello/index.ts": "export default () => 1;",
      "function/hello/package.json": JSON.stringify({dependencies: {lodash: "^4.0.0"}}),
      "function/plain/schema.yaml": "name: plain\nlanguage: javascript\n",
      "function/plain/index.mjs": "export default () => 2;"
    });
    const result = await functionModule.readLocal("", source);
    const bySlug = Object.fromEntries(result.map(r => [r.slug, r.data]));
    expect(bySlug.hello).toEqual({
      schema: {name: "hello", language: "typescript"},
      index: "export default () => 1;",
      dependencies: {lodash: "^4.0.0"}
    });
    expect(bySlug.plain).toEqual({
      schema: {name: "plain", language: "javascript"},
      index: "export default () => 2;",
      dependencies: {}
    });
  });

  it("honours a nested root directory", async () => {
    const source = memorySource({"spica/policy/Admin/schema.yaml": "name: Admin\n"});
    const result = await policyModule.readLocal("spica", source);
    expect(result).toEqual([{slug: "Admin", data: {name: "Admin"}}]);
  });
});

describe("buildPlan with a memory source", () => {
  it("plans against in-memory files instead of the disk", async () => {
    const http = {
      get: jest.fn(async (url: string) => (url === "bucket" ? [{_id: "b1", title: "Old"}] : [])),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
      patch: jest.fn(),
      head: jest.fn()
    };
    const plan = await buildPlan(ALL_MODULES, http, "/does/not/exist", {
      source: memorySource({"/does/not/exist/bucket/New/schema.yaml": "title: New\n"})
    });
    const bucketPlan = plan.modules.find(m => m.module.name === "bucket")!;
    expect(bucketPlan.creates.map(e => e.slug)).toEqual(["New"]);
    expect(bucketPlan.deletes.map(e => e.slug)).toEqual(["Old"]);
  });
});
