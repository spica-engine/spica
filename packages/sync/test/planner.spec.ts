import {
  buildPlan,
  applyPlan,
  fetchToDisk,
  diffObjectFields,
  buildUnifiedDiff,
  renderPlan,
  SYSTEM_KEY_FIELDS
} from "@spica-server/sync";
import {
  ChangeKind,
  DEFAULT_CONCURRENCY,
  LocalResource,
  RemoteResource,
  ResourceModule
} from "@spica-server/sync";
import {createTrackingHttp} from "./helpers/tracking-http";

const SHAPES = Object.entries(SYSTEM_KEY_FIELDS);

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

describe.each(SHAPES)("diffObjectFields (%s records)", (_shape, key) => {
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
    const changed = diffObjectFields({a: 1, [key]: "123"}, {a: 1, [key]: "456"}, [key]);
    expect(changed).not.toContain(key);
  });

  it("handles nested objects with deep equality", () => {
    const changed = diffObjectFields({props: {x: 1, y: 2}}, {props: {x: 1, y: 2}}, []);
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

describe.each(SHAPES)("buildPlan (%s records)", (_shape, key) => {
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
      {slug: "item", data: {name: "item", [key]: "local-id", value: "x"}}
    ];
    const remotes: RemoteResource[] = [
      {slug: "item", id: "remote-id", data: {name: "item", [key]: "remote-id", value: "x"}}
    ];

    const mod = makeMockModule("test", locals, remotes, [key]);
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

  it("does not call renderDetail when detailed=false (default)", async () => {
    const local: LocalResource = {slug: "item", data: {name: "item", value: "new"}};
    const remote: RemoteResource = {slug: "item", id: "id-1", data: {name: "item", value: "old"}};
    const mod = makeMockModule("test", [local], [remote]);
    const renderDetailSpy = jest.spyOn(mod, "renderDetail");

    await buildPlan([mod], mockHttp, "/tmp");
    expect(renderDetailSpy).not.toHaveBeenCalled();
  });

  it("calls renderDetail when detailed=true", async () => {
    const local: LocalResource = {slug: "item", data: {name: "item", value: "new"}};
    const remote: RemoteResource = {slug: "item", id: "id-1", data: {name: "item", value: "old"}};
    const mod = makeMockModule("test", [local], [remote]);
    const renderDetailSpy = jest.spyOn(mod, "renderDetail");

    await buildPlan([mod], mockHttp, "/tmp", {detailed: true});
    expect(renderDetailSpy).toHaveBeenCalledTimes(1);
  });
});

describe.each(SHAPES)("buildPlan — rename detection (%s records)", (_shape, key) => {
  const mockHttp = {} as any;

  function makeMockModuleWithId(
    locals: LocalResource[],
    remotes: RemoteResource[],
    extractLocalId: (data: any) => string | undefined
  ) {
    const mod = makeMockModule("test", locals, remotes);
    (mod as any).extractLocalId = extractLocalId;
    return mod;
  }

  it("promotes a create+delete pair sharing the same key to an update", async () => {
    // Remote has "Members" (_id: "abc"). Local has "Members" but reads _id: "abc" from its yaml
    // (i.e. the user renamed the local folder from "Users" to "Members" and kept _id in schema).
    const local: LocalResource = {slug: "Members", data: {name: "Members", [key]: "abc"}};
    const remote: RemoteResource = {slug: "Users", id: "abc", data: {name: "Users"}};

    const mod = makeMockModuleWithId([local], [remote], d => d[key]);
    const plan = await buildPlan([mod], mockHttp, "/tmp");
    const mp = plan.modules[0];

    expect(mp.creates).toHaveLength(0);
    expect(mp.deletes).toHaveLength(0);
    expect(mp.updates).toHaveLength(1);
    expect(mp.updates[0].slug).toBe("Members");
    expect(mp.updates[0].remote!.id).toBe("abc");
  });

  it("leaves create+delete unpromoted when _ids do not match", async () => {
    const local: LocalResource = {slug: "Members", data: {name: "Members", [key]: "different-id"}};
    const remote: RemoteResource = {slug: "Users", id: "abc", data: {name: "Users"}};

    const mod = makeMockModuleWithId([local], [remote], d => d[key]);
    const plan = await buildPlan([mod], mockHttp, "/tmp");
    const mp = plan.modules[0];

    expect(mp.creates).toHaveLength(1);
    expect(mp.deletes).toHaveLength(1);
    expect(mp.updates).toHaveLength(0);
  });

  it("leaves create+delete unpromoted when local has no key", async () => {
    const local: LocalResource = {slug: "Members", data: {name: "Members"}};
    const remote: RemoteResource = {slug: "Users", id: "abc", data: {name: "Users"}};

    const mod = makeMockModuleWithId([local], [remote], d => d[key]);
    const plan = await buildPlan([mod], mockHttp, "/tmp");
    const mp = plan.modules[0];

    expect(mp.creates).toHaveLength(1);
    expect(mp.deletes).toHaveLength(1);
    expect(mp.updates).toHaveLength(0);
  });

  it("does not promote renames when detectRenames=false (fetch mode)", async () => {
    const local: LocalResource = {slug: "Members", data: {name: "Members", [key]: "abc"}};
    const remote: RemoteResource = {slug: "Users", id: "abc", data: {name: "Users"}};

    const mod = makeMockModuleWithId([local], [remote], d => d[key]);
    // detectRenames=false simulates fetch path
    const plan = await buildPlan([mod], mockHttp, "/tmp", {detectRenames: false});
    const mp = plan.modules[0];

    expect(mp.creates).toHaveLength(1);
    expect(mp.deletes).toHaveLength(1);
    expect(mp.updates).toHaveLength(0);
  });

  it("does not affect modules without extractLocalId", async () => {
    const local: LocalResource = {slug: "Members", data: {name: "Members", [key]: "abc"}};
    const remote: RemoteResource = {slug: "Users", id: "abc", data: {name: "Users"}};

    // makeMockModule does not set extractLocalId
    const mod = makeMockModule("test", [local], [remote]);
    const plan = await buildPlan([mod], mockHttp, "/tmp");
    const mp = plan.modules[0];

    expect(mp.creates).toHaveLength(1);
    expect(mp.deletes).toHaveLength(1);
    expect(mp.updates).toHaveLength(0);
  });

  it("only promotes the matched pair — independent creates and deletes remain", async () => {
    const renamedLocal: LocalResource = {slug: "Members", data: {name: "Members", [key]: "abc"}};
    const newLocal: LocalResource = {slug: "Products", data: {name: "Products"}};
    const renamedRemote: RemoteResource = {slug: "Users", id: "abc", data: {name: "Users"}};
    const stalRemote: RemoteResource = {slug: "Orders", id: "xyz", data: {name: "Orders"}};

    const mod = makeMockModuleWithId(
      [renamedLocal, newLocal],
      [renamedRemote, stalRemote],
      d => d[key]
    );
    const plan = await buildPlan([mod], mockHttp, "/tmp");
    const mp = plan.modules[0];

    // "Members" (_id: abc) is promoted from create+delete to update
    expect(mp.updates).toHaveLength(1);
    expect(mp.updates[0].slug).toBe("Members");

    // "Products" has no _id → remains a create
    expect(mp.creates).toHaveLength(1);
    expect(mp.creates[0].slug).toBe("Products");

    // "Orders" has no local counterpart with _id "xyz" → remains a delete
    expect(mp.deletes).toHaveLength(1);
    expect(mp.deletes[0].slug).toBe("Orders");
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
    const deleteRemote: RemoteResource = {
      slug: "to-delete",
      id: "del-id",
      data: {name: "to-delete"}
    };
    const updateRemote: RemoteResource = {
      slug: "to-update",
      id: "upd-id",
      data: {name: "to-update", v: "old"}
    };

    const locals = [createLocal, updateLocal];
    const remotes = [updateRemote, deleteRemote];

    const mod = makeMockModule("test", locals, remotes);
    const plan = await buildPlan([mod], mockHttp, "/tmp");

    await applyPlan(plan, mockHttp, {concurrency: 5});

    expect(mod.delete).toHaveBeenCalledWith(expect.anything(), "del-id");
    expect(mod.update).toHaveBeenCalledWith(expect.anything(), updateLocal, "upd-id");
    expect(mod.create).toHaveBeenCalledWith(expect.anything(), createLocal);
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
    const plan = await buildPlan([mod], mockHttp, "/tmp");
    const {written, deleted, errors} = await fetchToDisk(plan, mockHttp, "/tmp");

    expect(mod.writeLocal).toHaveBeenCalledTimes(2);
    expect(written).toBe(2);
    expect(deleted).toBe(0);
    expect(errors).toHaveLength(0);
  });

  it("skips writeLocal when local already matches remote", async () => {
    const locals: LocalResource[] = [{slug: "a", data: {name: "a"}}];
    const remotes: RemoteResource[] = [{slug: "a", id: "id-a", data: {name: "a"}}];
    const mod = makeMockModule("test", locals, remotes);
    const plan = await buildPlan([mod], mockHttp, "/tmp");

    const {written} = await fetchToDisk(plan, mockHttp, "/tmp");
    expect(mod.writeLocal).not.toHaveBeenCalled();
    expect(written).toBe(0);
  });

  it("writes when local differs from remote", async () => {
    const locals: LocalResource[] = [{slug: "a", data: {name: "a", title: "old"}}];
    const remotes: RemoteResource[] = [{slug: "a", id: "id-a", data: {name: "a", title: "new"}}];
    const mod = makeMockModule("test", locals, remotes);
    const plan = await buildPlan([mod], mockHttp, "/tmp");

    const {written} = await fetchToDisk(plan, mockHttp, "/tmp");
    expect(mod.writeLocal).toHaveBeenCalledTimes(1);
    expect(written).toBe(1);
  });

  it("calls deleteLocal for stale local resources when --clean is set", async () => {
    const locals: LocalResource[] = [{slug: "stale", data: {name: "stale"}}];
    const remotes: RemoteResource[] = [{slug: "fresh", id: "id-1", data: {name: "fresh"}}];
    const mod = makeMockModule("test", locals, remotes);
    const plan = await buildPlan([mod], mockHttp, "/tmp");

    const {deleted} = await fetchToDisk(plan, mockHttp, "/tmp", {clean: true});
    expect(mod.deleteLocal).toHaveBeenCalledWith("/tmp", "stale");
    expect(deleted).toBe(1);
  });

  it("does not call deleteLocal when --clean is not set", async () => {
    const locals: LocalResource[] = [{slug: "stale", data: {name: "stale"}}];
    const remotes: RemoteResource[] = [{slug: "fresh", id: "id-1", data: {name: "fresh"}}];
    const mod = makeMockModule("test", locals, remotes);
    const plan = await buildPlan([mod], mockHttp, "/tmp");

    await fetchToDisk(plan, mockHttp, "/tmp");
    expect(mod.deleteLocal).not.toHaveBeenCalled();
  });

  it("collects errors without throwing when abortOnError is false", async () => {
    const remotes: RemoteResource[] = [{slug: "fail", id: "id-fail", data: {name: "fail"}}];
    const mod = makeMockModule("test", [], remotes);
    mod.writeLocal.mockRejectedValue(new Error("disk error"));
    const plan = await buildPlan([mod], mockHttp, "/tmp");

    const consolewarn = jest.spyOn(console, "warn").mockImplementation(() => {});
    const {errors} = await fetchToDisk(plan, mockHttp, "/tmp", {abortOnError: false});
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("disk error");
    consolewarn.mockRestore();
  });
});

describe("request concurrency", () => {
  const fanOut = (http: any, count: number, method: "get" | "put") =>
    Promise.all(Array.from({length: count}, (_, i) => http[method](`res/${i}`)));

  it("caps the requests a module issues while reading the remote state", async () => {
    const tracking = createTrackingHttp();
    const mod = makeMockModule("test", [], []);
    mod.readRemote.mockImplementation(async (http: any) => {
      await fanOut(http, 10, "get");
      return [];
    });

    await buildPlan([mod], tracking, "/tmp", {concurrency: 3});

    expect(tracking.calls).toHaveLength(10);
    expect(tracking.peak).toBe(3);
  });

  it("caps the requests modules issue while applying, even when each resource fans out", async () => {
    const tracking = createTrackingHttp();
    const locals = ["a", "b", "c", "d"].map(name => ({slug: name, data: {name, v: "new"}}));
    const remotes = ["a", "b", "c", "d"].map(name => ({
      slug: name,
      id: `id-${name}`,
      data: {name, v: "old"}
    }));
    const mod = makeMockModule("test", locals, remotes);
    mod.update.mockImplementation((http: any) => fanOut(http, 5, "put"));
    const plan = await buildPlan([mod], createTrackingHttp(), "/tmp");

    await applyPlan(plan, tracking, {concurrency: 2});

    expect(tracking.calls).toHaveLength(20);
    expect(tracking.peak).toBe(2);
  });

  it("uses the default limit when no concurrency is given", async () => {
    const tracking = createTrackingHttp();
    const mod = makeMockModule("test", [], []);
    mod.readRemote.mockImplementation(async (http: any) => {
      await fanOut(http, 40, "get");
      return [];
    });

    await buildPlan([mod], tracking, "/tmp");

    expect(tracking.peak).toBe(DEFAULT_CONCURRENCY);
  });
});

describe("applyPlan scheduling", () => {
  const tick = () => new Promise(resolve => setTimeout(resolve, 5));

  async function planWithCreates(count: number) {
    const locals = Array.from({length: count}, (_, i) => ({
      slug: `r${i}`,
      data: {name: `r${i}`}
    }));
    const mod = makeMockModule("test", locals, []);
    const plan = await buildPlan([mod], {} as any, "/tmp");
    return {mod, plan};
  }

  it("starts every resource of a phase without waiting for a slow one", async () => {
    const {mod, plan} = await planWithCreates(6);
    let releaseSlow!: () => void;
    mod.create.mockImplementation((_http: any, local: LocalResource) =>
      local.slug === "r0"
        ? new Promise<void>(resolve => (releaseSlow = resolve))
        : Promise.resolve()
    );

    const applying = applyPlan(plan, {} as any, {concurrency: 2});
    await tick();

    expect(mod.create).toHaveBeenCalledTimes(6);

    releaseSlow();
    await applying;
  });

  it("finishes a phase before starting the next one", async () => {
    const locals = [{slug: "new", data: {name: "new", v: 1}}];
    const remotes = [
      {slug: "old", id: "old-id", data: {name: "old"}},
      {slug: "new", id: "new-id", data: {name: "new", v: 0}}
    ];
    const mod = makeMockModule("test", locals, remotes);
    const plan = await buildPlan([mod], {} as any, "/tmp");
    let releaseDelete!: () => void;
    mod.delete.mockImplementation(() => new Promise<void>(resolve => (releaseDelete = resolve)));

    const applying = applyPlan(plan, {} as any);
    await tick();
    expect(mod.update).not.toHaveBeenCalled();

    releaseDelete();
    await applying;
    expect(mod.update).toHaveBeenCalledTimes(1);
  });

  it("does not send queued requests after a failure with abortOnError", async () => {
    const {mod, plan} = await planWithCreates(8);
    const tracking = createTrackingHttp((_method, url) => {
      if (url === "r/r0") throw new Error("api error");
      return {};
    });
    mod.create.mockImplementation((http: any, local: LocalResource) =>
      http.post(`r/${local.slug}`)
    );

    await expect(applyPlan(plan, tracking, {concurrency: 1, abortOnError: true})).rejects.toThrow(
      "api error"
    );

    // The slot freed by the failing request is handed to the next queued one before the abort lands.
    expect(tracking.calls.map(c => c.url)).toEqual(["r/r0", "r/r1"]);
  });

  it("waits for resources already running before rejecting with abortOnError", async () => {
    const {mod, plan} = await planWithCreates(2);
    let slowFinished = false;
    let releaseSlow!: () => void;
    mod.create.mockImplementation((_http: any, local: LocalResource) => {
      if (local.slug === "r0") return Promise.reject(new Error("api error"));
      return new Promise<void>(resolve => {
        releaseSlow = () => {
          slowFinished = true;
          resolve();
        };
      });
    });

    let settled = false;
    const applying = applyPlan(plan, {} as any, {concurrency: 2, abortOnError: true}).catch(() => {
      settled = true;
    });
    await tick();
    expect(settled).toBe(false);

    releaseSlow();
    await applying;
    expect(slowFinished).toBe(true);
    expect(settled).toBe(true);
  });

  it("rejects with the first failure, not with the errors it caused", async () => {
    const {mod, plan} = await planWithCreates(4);
    const tracking = createTrackingHttp((_method, url) => {
      if (url === "r/r0") throw new Error("root cause");
      return {};
    });
    mod.create.mockImplementation((http: any, local: LocalResource) =>
      http.post(`r/${local.slug}`)
    );

    await expect(applyPlan(plan, tracking, {concurrency: 1, abortOnError: true})).rejects.toThrow(
      /^Creating test: r0: root cause$/
    );
  });

  it("applies every resource and collects errors without abortOnError", async () => {
    const {mod, plan} = await planWithCreates(6);
    mod.create.mockImplementation(async (_http: any, local: LocalResource) => {
      if (local.slug === "r1") throw new Error("api error");
    });
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});

    const {errors} = await applyPlan(plan, {} as any, {concurrency: 2});

    expect(mod.create).toHaveBeenCalledTimes(6);
    expect(errors).toHaveLength(1);
    warn.mockRestore();
  });
});
