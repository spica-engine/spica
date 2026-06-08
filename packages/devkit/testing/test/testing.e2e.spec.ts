import axios from "axios";
import {start} from "../";
import {SpicaInstance} from "../src/interface";

/**
 * Real-docker integration. Opt in with SPICA_E2E_DOCKER=1 (a docker daemon must be running):
 *
 *   SPICA_E2E_DOCKER=1 yarn nx test devkit/testing
 *
 * Pin the api version with SPICA_E2E_VERSION for deterministic runs.
 */
const RUN = process.env.SPICA_E2E_DOCKER === "1";
const describeIf = RUN ? describe : describe.skip;

describeIf("@spica-devkit/testing (integration)", () => {
  jest.setTimeout(300_000);

  let spica: SpicaInstance;

  beforeAll(async () => {
    spica = await start({
      version: process.env.SPICA_E2E_VERSION || "latest",
      installResources: false
    });
  });

  afterAll(async () => {
    if (spica) {
      await spica.teardown({retainVolumes: false});
    }
  });

  function authed() {
    return axios.create({
      baseURL: spica.url,
      headers: {Authorization: `APIKEY ${spica.apikey.key}`}
    });
  }

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

    const bucket = (
      await http.post("/bucket", {
        title: "Cars",
        description: "test bucket",
        primary: "name",
        properties: {name: {type: "string", title: "name", options: {position: "bottom"}}}
      })
    ).data;

    await http.post(`/bucket/${bucket._id}/data`, {name: "Tesla"});

    const before = (await http.get(`/bucket/${bucket._id}/data`)).data;
    expect(before.length).toBe(1);

    await spica.reset(["bucket-data"]);

    const after = (await http.get(`/bucket/${bucket._id}/data`)).data;
    expect(after.length).toBe(0);
  });
});
