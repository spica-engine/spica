import {buildPlan, applyPlan, fetchToDisk, diffObjectFields, buildUnifiedDiff, renderPlan} from "@spica/cli/src/commands/sync/planner";
import {ChangeKind, LocalResource, RemoteResource, ResourceModule} from "@spica/cli/src/commands/sync/types";

function makeMockModule(
  name: string,
  locals: LocalResource[],
  remotes: RemoteResource[],
  ignoredFields: string[] = []
): ResourceModule & {
  create: jest.Mock;
  update: jest.Mock;
  delete: jest.Mock;
  writeLocal: jest.Mock;
  deleteLocal: jest.Mock;
} {
  return {
    name,
    displayName: name,
    identityField: "name",
    ignoredFields,

    readLocal: jest.fn().mockResolvedValue(locals),
    readRemote: jest.fn().mockResolvedValue(remotes),
    create: jest.fn().mockResolvedValue(undefined),
    update: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(undefined),
    writeLocal: jest.fn().mockResolvedValue(undefined),
    deleteLocal: jest.fn().mockResolvedValue(undefined),

    diffFields(local: any, remote: any) {
      return diffObjectFields(local, remote, ignoredFields);
    },
    renderDetail(_local: any, _remote: any) {
      return {};
    },
    summaryLine(r: any) {
      return String(r.slug);
    }
  };
}

describe("diffObjectFields", () => {
  it("returns empty when objects are equal", () => {
    expect(diffObjectFields({a: 1, b: "x"}, {a: 1, b: "x"}, [])).toEqual([]);
  });

  it("returns changed field names", () => {
    const changed = diffObjectFields({a: 1, b: "old"}, {a: 1, b: "new"}, []);
    expect(changed).toEqual(["b"]);
  });

  it("includes fields present only in local", () => {
    const changed = diffObjectFields({a: 1, c: "new"}, {a: 1}, []);
    expect(changed).toContain("c");
  });

  it("excludes ignoredFields", () => {
    const changed = diffObjectFields({a: 1, _id: "123"}, {a: 1, _id: "456"}, ["_id"]);
    expect(changed).not.toContain("_id");
  });

  it("handles nested objects with deep equality", () => {
    const changed = diffObjectFields(
      {props: {x: 1, y: 2}},
      {props: {x: 1, y: 2}},
      []
    );
    expect(changed).toEqual([]);
  });
});

describe("buildUnifiedDiff", () => {
  it("returns a unified diff string", () => {
    const diff = buildUnifiedDiff("old content\n", "new content\n", "file.yaml");
    expect(diff).toContain("-old content");
    expect(diff).toContain("+new content");
  });
});

describe("buildPlan", () => {
  const mockHttp = {} as any;

  it("classifies creates, updates, deletes correctly", async () => {
    const locals: LocalResource[] = [
      {slug: "create-me", data: {name: "create-me", value: "a"}},
      {slug: "update-me", data: {name: "update-me", value: "new"}}
    ];
    const remotes: RemoteResource[] = [
      {slug: "update-me", id: "id-2", data: {name: "update-me", value: "old"}},
      {slug: "delete-me", id: "id-3", data: {name: "delete-me", value: "b"}}
    ];

    const mod = makeMockModule("test", locals, remotes);
    const plan = await buildPlan([mod], mockHttp, "/tmp");

    expect(plan.modules).toHaveLength(1);
    const mp = plan.modules[0];

    expect(mp.creates).toHaveLength(1);
    expect(mp.creates[0].slug).toBe("create-me");
    expect(mp.creates[0].kind).toBe(ChangeKind.Create);

    expect(mp.updates).toHaveLength(1);
    expect(mp.updates[0].slug).toBe("update-me");
    expect(mp.updates[0].kind).toBe(ChangeKind.Update);
    expect(mp.updates[0].changedFields).toContain("value");

    expect(mp.deletes).toHaveLength(1);
    expect(mp.deletes[0].slug).toBe("delete-me");
    expect(mp.deletes[0].kind).toBe(ChangeKind.Delete);
  });

  it("produces no entries when local matches remote", async () => {
    const data = {name: "same", value: "x"};
    const locals: LocalResource[] = [{slug: "same", data}];
    const remotes: RemoteResource[] = [{slug: "same", id: "id-1", data}];

    const mod = makeMockModule("test", locals, remotes);
    const plan = await buildPlan([mod], mockHttp, "/tmp");

    const mp = plan.modules[0];
    expect(mp.creates).toHaveLength(0);
    expect(mp.updates).toHaveLength(0);
    expect(mp.deletes).toHaveLength(0);
  });

  it("ignores specified fields when comparing", async () => {
    const locals: LocalResource[] = [
      {slug: "item", data: {name: "item", _id: "local-id", value: "x"}}
    ];
    const remotes: RemoteResource[] = [
      {slug: "item", id: "remote-id", data: {name: "item", _id: "remote-id", value: "x"}}
    ];

    const mod = makeMockModule("test", locals, remotes, ["_id"]);
    const plan = await buildPlan([mod], mockHttp, "/tmp");

    expect(plan.modules[0].updates).toHaveLength(0);
  });

  it("stores local and remote resources in entries for apply", async () => {
    const local: LocalResource = {slug: "item", data: {name: "item", value: "new"}};
    const remote: RemoteResource = {slug: "item", id: "id-1", data: {name: "item", value: "old"}};

    const mod = makeMockModule("test", [local], [remote]);
    const plan = await buildPlan([mod], mockHttp, "/tmp");

    const entry = plan.modules[0].updates[0];
    expect(entry.local).toBe(local);
    expect(entry.remote).toBe(remote);
  });
});

describe("renderPlan", () => {
  let consoleSpy: jest.SpyInstance;
  beforeEach(() => {
    consoleSpy = jest.spyOn(process.stdout, "write").mockImplementation(() => true);
    jest.spyOn(console, "log").mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  it("logs no-changes message when plan is empty", async () => {
    const consolelog = jest.spyOn(console, "log");
    const mod = makeMockModule("test", [], []);
    const plan = await buildPlan([mod], {} as any, "/tmp");
    renderPlan(plan);
    const calls = consolelog.mock.calls.map(c => c.join("")).join("\n");
    expect(calls).toMatch(/No changes/);
  });

  it("outputs JSON when json option is true", async () => {
    const consolelog = jest.spyOn(console, "log");
    const locals: LocalResource[] = [{slug: "new-item", data: {name: "new-item"}}];
    const mod = makeMockModule("test", locals, []);
    const plan = await buildPlan([mod], {} as any, "/tmp");
    renderPlan(plan, {json: true});

    const jsonStr = consolelog.mock.calls[0][0];
    const parsed = JSON.parse(jsonStr);
    expect(parsed[0].module).toBe("test");
    expect(parsed[0].creates[0].slug).toBe("new-item");
  });
});

describe("applyPlan", () => {
  const mockHttp = {} as any;

  it("calls delete, update, create in order for each entry", async () => {
    const createLocal: LocalResource = {slug: "to-create", data: {name: "to-create"}};
    const updateLocal: LocalResource = {slug: "to-update", data: {name: "to-update", v: "new"}};
    const deleteRemote: RemoteResource = {slug: "to-delete", id: "del-id", data: {name: "to-delete"}};
    const updateRemote: RemoteResource = {slug: "to-update", id: "upd-id", data: {name: "to-update", v: "old"}};

    const locals = [createLocal, updateLocal];
    const remotes = [updateRemote, deleteRemote];

    const mod = makeMockModule("test", locals, remotes);
    const plan = await buildPlan([mod], mockHttp, "/tmp");

    await applyPlan(plan, mockHttp, {concurrency: 5});

    expect(mod.delete).toHaveBeenCalledWith(mockHttp, "del-id");
    expect(mod.update).toHaveBeenCalledWith(mockHttp, updateLocal, "upd-id");
    expect(mod.create).toHaveBeenCalledWith(mockHttp, createLocal);
  });

  it("collects errors without throwing when abortOnError is false", async () => {
    const local: LocalResource = {slug: "fail", data: {name: "fail"}};
    const mod = makeMockModule("test", [local], []);
    mod.create.mockRejectedValue(new Error("api error"));

    const plan = await buildPlan([mod], mockHttp, "/tmp");
    const consolewarn = jest.spyOn(console, "warn").mockImplementation(() => {});
    const {errors} = await applyPlan(plan, mockHttp, {abortOnError: false});
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("api error");
    consolewarn.mockRestore();
  });
});

describe("fetchToDisk", () => {
  const mockHttp = {} as any;

  it("calls writeLocal for all remote resources", async () => {
    const remotes: RemoteResource[] = [
      {slug: "a", id: "id-a", data: {name: "a"}},
      {slug: "b", id: "id-b", data: {name: "b"}}
    ];
    const mod = makeMockModule("test", [], remotes);
    const {written, deleted} = await fetchToDisk([mod], mockHttp, "/tmp");

    expect(mod.writeLocal).toHaveBeenCalledTimes(2);
    expect(written).toBe(2);
    expect(deleted).toBe(0);
  });

  it("calls deleteLocal for stale local resources when --clean is set", async () => {
    const locals: LocalResource[] = [{slug: "stale", data: {name: "stale"}}];
    const remotes: RemoteResource[] = [{slug: "fresh", id: "id-1", data: {name: "fresh"}}];
    const mod = makeMockModule("test", locals, remotes);

    const {deleted} = await fetchToDisk([mod], mockHttp, "/tmp", {clean: true});
    expect(mod.deleteLocal).toHaveBeenCalledWith("/tmp", "stale");
    expect(deleted).toBe(1);
  });

  it("does not call deleteLocal when --clean is not set", async () => {
    const locals: LocalResource[] = [{slug: "stale", data: {name: "stale"}}];
    const remotes: RemoteResource[] = [{slug: "fresh", id: "id-1", data: {name: "fresh"}}];
    const mod = makeMockModule("test", locals, remotes);

    await fetchToDisk([mod], mockHttp, "/tmp");
    expect(mod.deleteLocal).not.toHaveBeenCalled();
  });
});
