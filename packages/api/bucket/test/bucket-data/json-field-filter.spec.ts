import {DatabaseTestingModule, mongoOnly} from "@spica-server/database-testing";
import {BucketApp, startBucketApp} from "../support/bucket-app";
import {idOf} from "@spica-server/data";

mongoOnly(
  "filters on the fields inside a json value, which the PostgreSQL rule compiler refuses (Part 7)"
);

describe("BucketDataController: filters inside a json value", () => {
  let api: BucketApp;
  let bucket;
  let rows;

  beforeEach(async () => {
    api = await startBucketApp({name: "mongodb", module: () => DatabaseTestingModule.replicaSet()});
    bucket = await api.createBucket(
      {
        name: {type: "string", options: {}},
        characteristics: {type: "json", options: {}}
      },
      {title: "new bucket", description: "new bucket"}
    );

    rows = [
      await api.req.post(`/bucket/${idOf(bucket)}/data`, {
        name: "James",
        characteristics: {height: 184, weight: "75kg"}
      }),
      await api.req.post(`/bucket/${idOf(bucket)}/data`, {
        name: "Braim",
        characteristics: {height: 170, weight: "70kg"}
      })
    ].map(r => r.body);
  });

  afterEach(() => api.close());

  it("should filter documents based on multiple characteristics", async () => {
    const document = await api.req.get(`/bucket/${idOf(bucket)}/data`, {
      filter: JSON.stringify({characteristics: {height: 170, weight: "70kg"}})
    });

    expect([document.statusCode, document.statusText]).toEqual([200, "OK"]);
    expect(document.body[0]).toEqual(rows[1]);
  });

  it("should filter documents based on a single characteristic", async () => {
    const document = await api.req.get(`/bucket/${idOf(bucket)}/data`, {
      filter: JSON.stringify({"characteristics.height": {$eq: 184}})
    });

    expect([document.statusCode, document.statusText]).toEqual([200, "OK"]);
    expect(document.body[0]).toEqual(rows[0]);
  });
});
