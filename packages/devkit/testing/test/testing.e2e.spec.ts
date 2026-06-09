import axios from "axios";
import path from "path";
import {fileURLToPath} from "url";
import {start} from "../";
import {SpicaInstance} from "../src/interface";

/**
 * Real-docker integration. Opt in with SPICA_E2E_DOCKER=1 (a docker daemon must be running):
 *
 *   SPICA_E2E_DOCKER=1 yarn nx test devkit/testing
 *
 * Override the api version with SPICA_E2E_VERSION. The default is pinned (not "latest") so
 * the suite is deterministic and exercises a release that exposes the public /status routes.
 *
 * The package exposes only `publicUrl` + waitForReady/reset/teardown, so — like any test
 * writer — this suite authenticates the server itself: it logs in as the default identity
 * (the documented "spica"/"spica" credentials it started with) to get an IDENTITY token.
 */
const RUN = process.env.SPICA_E2E_DOCKER === "1";
const DEFAULT_VERSION = "0.18.41";
const describeIf = RUN ? describe : describe.skip;
const VERSION = process.env.SPICA_E2E_VERSION || DEFAULT_VERSION;

// Default credentials start() bootstraps the instance with.
const IDENTIFIER = "spica";
const PASSWORD = "spica";

// CLI-format resources (bucket/, policy/, function/) installed by start().
const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");

function unwrapList(data: any): any[] {
  return Array.isArray(data) ? data : (data?.data ?? []);
}

async function identify(url: string): Promise<string> {
  const res = await axios.post(
    `${url}/passport/identify`,
    {identifier: IDENTIFIER, password: PASSWORD},
    {validateStatus: () => true}
  );
  return res.data.token;
}

describeIf("@spica-devkit/testing (integration)", () => {
  jest.setTimeout(300_000);

  let spica: SpicaInstance;
  let token: string;
  let startError: Error | undefined;

  beforeAll(async () => {
    try {
      // one step: fresh instance + install the fixture resources
      spica = await start({version: VERSION, resourcePath: FIXTURES});
      token = await identify(spica.publicUrl);
    } catch (e: any) {
      // Keep a flat message - raw axios/docker errors are not worker-serializable.
      startError = new Error(e?.message || String(e));
    }
  });

  afterAll(async () => {
    if (spica) {
      await spica.teardown({retainVolumes: false});
    }
  });

  beforeEach(() => {
    if (startError) throw startError;
  });

  // status: () => true so non-2xx never throws a circular axios error out of the test.
  function client(authorization: string) {
    return axios.create({
      baseURL: spica.publicUrl,
      headers: {Authorization: authorization},
      validateStatus: () => true
    });
  }
  const authed = () => client(`IDENTITY ${token}`);

  // ── bring-up ────────────────────────────────────────────────────────────────
  it("exposes only the public url, no credentials or connection internals", () => {
    expect(spica.publicUrl).toMatch(/^http:\/\/localhost:\d+$/);
    expect((spica as any).token).toBeUndefined();
    expect((spica as any).apikey).toBeUndefined();
    expect((spica as any).mongoUrl).toBeUndefined();
    expect((spica as any).identifier).toBeUndefined();
  });

  it("serves a ready status without auth", async () => {
    const res = await axios.get(`${spica.publicUrl}/status/ready`, {validateStatus: () => true});
    expect(res.status).toBe(200);
  });

  it("the default identity authorizes admin requests", async () => {
    const res = await authed().get("/bucket");
    expect(res.status).toBe(200);
  });

  // ── resources installed by start (the headline feature) ──────────────────────
  describe("resources installed by start()", () => {
    it("created the bucket from disk", async () => {
      const res = await authed().get("/bucket");
      const products = unwrapList(res.data).find((b: any) => b.title === "Products");
      expect(products).toBeDefined();
      expect(products.properties.stock.type).toBe("number");
    });

    it("created the policy from disk", async () => {
      const res = await authed().get("/passport/policy");
      expect(unwrapList(res.data).some((p: any) => p.name === "Products Read Only")).toBe(true);
    });

    it("created the function and uploaded its index from disk", async () => {
      const res = await authed().get("/function");
      const fn = unwrapList(res.data).find((f: any) => f.name === "SeedProducts");
      expect(fn).toBeDefined();
      expect(fn.triggers.seed.type).toBe("http");

      const index = await authed().get(`/function/${fn._id}/index`);
      expect(index.data.index).toContain("seeded");
    });
  });

  // ── bucket-data lifecycle + scoped reset ────────────────────────────────────
  it("creates, fills, reads, then resets bucket-data end-to-end", async () => {
    const http = authed();

    const created = await http.post("/bucket", {
      title: "Cars",
      description: "test bucket",
      primary: "name",
      properties: {name: {type: "string", title: "name"}}
    });
    expect(created.status).toBeLessThan(300);
    const bucket = created.data;

    const inserted = await http.post(`/bucket/${bucket._id}/data`, {name: "Tesla"});
    expect(inserted.status).toBeLessThan(300);

    const before = await http.get(`/bucket/${bucket._id}/data`);
    expect(before.data.length).toBe(1);

    await spica.reset(["bucket-data"]);

    const after = await http.get(`/bucket/${bucket._id}/data`);
    expect(after.data.length).toBe(0);

    // a data-only reset must leave the schema intact
    const schemaStillThere = await http.get(`/bucket/${bucket._id}`);
    expect(schemaStillThere.status).toBe(200);
  });

  // ── reset matrix ────────────────────────────────────────────────────────────
  it("reset(['apikey']) clears every api key the test created", async () => {
    const created = (await authed().post("/passport/apikey", {name: "disposable", active: true}))
      .data;
    const before = unwrapList((await authed().get("/passport/apikey")).data).map((k: any) => k._id);
    expect(before).toContain(created._id);

    await spica.reset(["apikey"]);

    // every key is gone…
    const after = unwrapList((await authed().get("/passport/apikey")).data);
    expect(after.length).toBe(0);
    // …and the instance is still usable via the default identity (which reset preserves)
    expect((await authed().get("/bucket")).status).toBe(200);
  });

  it("reset(['bucket']) drops the bucket schemas as well", async () => {
    await spica.reset(["bucket"]);
    const res = await authed().get("/bucket");
    expect(unwrapList(res.data).length).toBe(0);
  });
});

// Teardown is verified in isolation so it can dispose of its own short-lived instance
// without affecting the shared one above.
describeIf("@spica-devkit/testing teardown", () => {
  jest.setTimeout(300_000);

  it("removes the instance so the api port stops responding", async () => {
    const spica = await start({version: VERSION, installResources: false});
    const url = spica.publicUrl;

    const up = await axios.get(`${url}/status/ready`, {validateStatus: () => true});
    expect(up.status).toBe(200);

    await spica.teardown({retainVolumes: false});

    // The published port mapping is gone — the connection is now refused.
    await expect(
      axios.get(`${url}/status/ready`, {timeout: 3000, validateStatus: () => true})
    ).rejects.toThrow();
  });
});
