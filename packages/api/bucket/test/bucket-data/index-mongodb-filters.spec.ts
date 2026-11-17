import {DatabaseTestingModule, mongoOnly} from "@spica-server/database-testing";
import {BucketApp, startBucketApp} from "../support/bucket-app";

mongoOnly(
  "the advanced filter constructors of MongoDB JSON filters, which PostgreSQL answers with a 404 because it has the one expression language (Part 8)"
);

describe("BucketDataController: advanced filter constructors", () => {
  let api: BucketApp;
  let bucketId: string;

  beforeEach(async () => {
    api = await startBucketApp({name: "mongodb", module: () => DatabaseTestingModule.replicaSet()});
    bucketId = (
      await api.createBucket({
        name: {type: "string"},
        created_at: {type: "date"}
      })
    )._id;
  });

  afterEach(() => api.close());

  it("should throw error if the advanced filter constructor does not exist", async () => {
    const {body: error} = await api.req
      .get(`/bucket/${bucketId}/data`, {
        filter: JSON.stringify({
          created_at: {
            $gt: `Throw(${new Date("2020-04-20T10:00:00.000Z").toISOString()})`
          }
        })
      })
      .catch(e => e);

    expect(error).toEqual({
      statusCode: 400,
      message: 'Could not find the constructor Throw in {"$gt":"Throw(2020-04-20T10:00:00.000Z)"}'
    });
  });
});
