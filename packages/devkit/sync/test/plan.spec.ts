import http from "http";
import {AddressInfo} from "net";
import {apply, plan, SpicaRequestError} from "../src";

type Bucket = {_id: string; title: string; [key: string]: unknown};

// A minimal stand-in for the Spica bucket API; every other list endpoint is empty.
function startFakeSpica() {
  const state = {
    buckets: [] as Bucket[],
    requests: [] as string[],
    authorization: [] as (string | undefined)[],
    failPosts: false,
    nextId: 1
  };

  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", chunk => (body += chunk));
    req.on("end", () => {
      const url = (req.url ?? "").replace(/^\/api\//, "");
      state.requests.push(`${req.method} ${url}`);
      state.authorization.push(req.headers.authorization);
      const send = (status: number, data?: unknown) => {
        res.writeHead(status, {"content-type": "application/json"});
        res.end(data === undefined ? "" : JSON.stringify(data));
      };

      const [resource, id] = url.split("/");
      if (resource !== "bucket") return send(200, []);

      if (req.method === "GET") return send(200, state.buckets);
      if (req.method === "POST") {
        if (state.failPosts) return send(400, {message: "invalid bucket"});
        const bucket = {...JSON.parse(body), _id: `id${state.nextId++}`};
        state.buckets.push(bucket);
        return send(201, bucket);
      }
      if (req.method === "PUT") {
        state.buckets = state.buckets.map(b => (b._id === id ? {...JSON.parse(body), _id: id} : b));
        return send(200, {});
      }
      if (req.method === "DELETE") {
        state.buckets = state.buckets.filter(b => b._id !== id);
        return send(204);
      }
      send(404, {message: "not found"});
    });
  });

  return new Promise<{url: string; state: typeof state; close: () => Promise<void>}>(resolve => {
    server.listen(0, "127.0.0.1", () => {
      const {port} = server.address() as AddressInfo;
      resolve({
        url: `http://127.0.0.1:${port}/api`,
        state,
        close: () => new Promise(r => server.close(() => r()))
      });
    });
  });
}

describe("plan and apply", () => {
  let spica: Awaited<ReturnType<typeof startFakeSpica>>;
  let connection: {url: string; authorization: string};

  beforeEach(async () => {
    spica = await startFakeSpica();
    connection = {url: spica.url, authorization: "APIKEY secret"};
    spica.state.buckets = [
      {_id: "keep", title: "Keep", properties: {a: {type: "string"}}},
      {_id: "change", title: "Change", properties: {a: {type: "string"}}},
      {_id: "gone", title: "Gone", properties: {}}
    ];
  });

  afterEach(() => spica.close());

  const files = {
    "bucket/Keep/schema.yaml": "title: Keep\nproperties:\n  a:\n    type: string\n",
    "bucket/Change/schema.yaml": "title: Change\nproperties:\n  a:\n    type: number\n",
    "bucket/New/schema.yaml": "title: New\nproperties: {}\n"
  };

  it("describes creates, updates and deletes as plain data", async () => {
    const result = await plan({connection, files, modules: ["bucket"]});

    expect(result.totals).toEqual({creates: 1, updates: 1, deletes: 1});
    expect(result.fingerprint).toMatch(/^[0-9a-f]{64}$/);
    const [bucket] = result.modules;
    expect(bucket.module).toBe("bucket");
    expect(bucket.creates.map(e => e.slug)).toEqual(["New"]);
    expect(bucket.deletes.map(e => e.slug)).toEqual(["Gone"]);
    expect(bucket.updates).toHaveLength(1);
    expect(bucket.updates[0].changedFields).toEqual(["properties"]);
    expect(bucket.updates[0].diffs.schema).toContain("+    type: number");
    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
    expect(spica.state.authorization.every(a => a === "APIKEY secret")).toBe(true);
  });

  it("produces the same fingerprint for the same files and remote state", async () => {
    const reordered = Object.fromEntries(Object.entries(files).reverse());
    const a = await plan({connection, files, modules: ["bucket"]});
    const b = await plan({
      connection,
      files: new Map(Object.entries(reordered)),
      modules: ["bucket"]
    });
    expect(a.fingerprint).toBe(b.fingerprint);
  });

  it("omits diffs longer than the limit", async () => {
    const result = await plan({connection, files, modules: ["bucket"], maxDiffLength: 10});
    const [update] = result.modules[0].updates;
    expect(update.diffs).toEqual({});
    expect(update.omittedDiffs).toEqual(["schema"]);
  });

  it("applies a reviewed plan", async () => {
    const reviewed = await plan({connection, files, modules: ["bucket"]});
    const result = await apply({
      connection,
      files,
      modules: ["bucket"],
      fingerprint: reviewed.fingerprint
    });

    expect(result.status).toBe("succeeded");
    expect(spica.state.buckets.map(b => b.title).sort()).toEqual(["Change", "Keep", "New"]);
    expect(spica.state.buckets.find(b => b.title === "Change")!.properties).toEqual({
      a: {type: "number"}
    });
  });

  it("refuses to apply when the remote changed after review", async () => {
    const reviewed = await plan({connection, files, modules: ["bucket"]});
    spica.state.buckets.push({_id: "late", title: "Late", properties: {}});
    spica.state.requests = [];

    const result = await apply({
      connection,
      files,
      modules: ["bucket"],
      fingerprint: reviewed.fingerprint
    });

    expect(result.status).toBe("outdated");
    expect(result.plan.totals).toEqual({creates: 1, updates: 1, deletes: 2});
    expect(spica.state.requests.filter(r => !r.startsWith("GET"))).toEqual([]);
  });

  it("refuses to apply when the files changed after review", async () => {
    const reviewed = await plan({connection, files, modules: ["bucket"]});
    const result = await apply({
      connection,
      files: {...files, "bucket/Another/schema.yaml": "title: Another\n"},
      modules: ["bucket"],
      fingerprint: reviewed.fingerprint
    });
    expect(result.status).toBe("outdated");
  });

  it("reports partial failures with the Spica error message", async () => {
    spica.state.failPosts = true;
    const reviewed = await plan({connection, files, modules: ["bucket"]});
    const result = await apply({
      connection,
      files,
      modules: ["bucket"],
      fingerprint: reviewed.fingerprint
    });

    expect(result.status).toBe("partial");
    if (result.status === "outdated") throw new Error("unexpected");
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("New");
    expect(result.errors[0]).toContain("400: invalid bucket");
  });

  it("succeeds with nothing to do when already in sync", async () => {
    const inSync = {
      "bucket/Keep/schema.yaml": files["bucket/Keep/schema.yaml"],
      "bucket/Change/schema.yaml": "title: Change\nproperties:\n  a:\n    type: string\n",
      "bucket/Gone/schema.yaml": "title: Gone\nproperties: {}\n"
    };
    const reviewed = await plan({connection, files: inSync, modules: ["bucket"]});
    expect(reviewed.totals).toEqual({creates: 0, updates: 0, deletes: 0});
    const result = await apply({
      connection,
      files: inSync,
      modules: ["bucket"],
      fingerprint: reviewed.fingerprint
    });
    expect(result).toMatchObject({status: "succeeded", errors: []});
  });

  it("rejects with a flat request error when the instance is unreachable", async () => {
    await spica.close();
    const error = await plan({connection, files, modules: ["bucket"]}).catch(e => e);
    expect(error).toBeInstanceOf(SpicaRequestError);
    expect(JSON.stringify(error)).not.toContain("APIKEY secret");
    spica = await startFakeSpica();
  });
});
