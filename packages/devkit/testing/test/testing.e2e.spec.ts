import axios from "axios";
import {start} from "../";
import {SpicaInstance} from "../src/interface";

/**
 * Real-docker integration. Opt in with SPICA_E2E_DOCKER=1 (a docker daemon must be running):
 *
 *   SPICA_E2E_DOCKER=1 yarn nx test devkit/testing
 *
 * Override the api version with SPICA_E2E_VERSION. The default is pinned (not "latest") so
 * the suite is deterministic and exercises a release that exposes the public /status routes.
 */
const RUN = process.env.SPICA_E2E_DOCKER === "1";
const DEFAULT_VERSION = "0.18.41";
const describeIf = RUN ? describe : describe.skip;

describeIf("@spica-devkit/testing (integration)", () => {
  jest.setTimeout(300_000);

  let spica: SpicaInstance;
  let startError: Error | undefined;

  beforeAll(async () => {
    try {
      spica = await start({
        version: process.env.SPICA_E2E_VERSION || DEFAULT_VERSION,
        installResources: false
      });
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
  function authed() {
    return axios.create({
      baseURL: spica.url,
      headers: {Authorization: `APIKEY ${spica.apikey.key}`},
      validateStatus: () => true
    });
  }

  it("starts and exposes connection details", () => {
    expect(spica.url).toMatch(/^http:\/\/localhost:\d+$/);
    expect(spica.token).toBeTruthy();
    expect(spica.apikey.key).toBeTruthy();
  });

  it("serves a ready status without auth", async () => {
    const res = await axios.get(`${spica.url}/status/ready`, {validateStatus: () => true});
    expect(res.status).toBe(200);
  });

  it("authorizes requests with the auto-created api key", async () => {
    const res = await authed().get("/passport/apikey");
    expect(res.status).toBe(200);
  });

  it("creates, fills, reads, then resets a bucket end-to-end", async () => {
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
  });
});
