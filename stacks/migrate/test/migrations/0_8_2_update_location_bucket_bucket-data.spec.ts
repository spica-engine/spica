import {Db, getConnectionUri, getDatabaseName, start} from "@spica-server/database/testing";
import * as color from "cli-color/lib/supports-color";
import {run} from "../../src/main";

describe("Update location for bucket schema and bucket-data", () => {
  let db: Db;
  let args: string[];

  let bucket1Id;
  let bucket2Id;
  let bucket3Id;

  beforeAll(() => {
    color.disableColor();
  });

  beforeEach(async () => {
    const connection = await start("replset");
    args = ["--database-uri", await getConnectionUri(), "--database-name", getDatabaseName()];
    db = connection.db(args[3]);

    await db
      .collection("buckets")
      .insertOne({
        title: "New Bucket",
        properties: {
          market: {
            type: "location"
          },
          description: {
            type: "string"
          },
          shop: {
            type: "location"
          }
        }
      })
      .then(async res => {
        bucket1Id = res.insertedId;
        await db.collection(`bucket_${bucket1Id}`).insertMany([
          {
            market: {
              longitude: 50,
              latitude: 51
            },
            description: "some desc",
            shop: {
              longitude: 100,
              latitude: 101
            }
          },
          {
            market: {
              longitude: 120,
              latitude: 121
            },
            description: "some desc"
            // shop field missing
          }
        ]);
      });

    await db
      .collection("buckets")
      .insertOne({
        title: "New Bucket2",
        properties: {
          home: {
            type: "location"
          }
        }
      })
      .then(async res => {
        bucket2Id = res.insertedId;
        await db.collection(`bucket_${bucket2Id}`).insertMany([
          {
            // latitude and longitude is missing
            home: {}
          },
          {
            // latitude and longitude have wrong order
            home: {
              latitude: 130,
              longitude: 131
            }
          }
        ]);
      });

    await db
      .collection("buckets")
      .insertOne({
        title: "New Bucket3",
        properties: {
          // unrelated bucket
          title: {
            type: "string"
          }
        }
      })
      .then(async res => {
        bucket3Id = res.insertedId;
        await db.collection(`bucket_${bucket3Id}`).insertMany([
          {
            // unrelated field
            title: "test"
          }
        ]);
      });
  });

  it("Add locationType to buckets, update bucket-data", async () => {
    await run([...args, "--from", "0.8.1", "--to", "0.8.2", "--continue-if-versions-are-equal"]);
    const buckets = await db
      .collection("buckets")
      .find({})
      .map(bucket => {
        delete bucket._id;
        return bucket;
      })
      .toArray();

    expect(buckets).toEqual([
      {
        title: "New Bucket",
        properties: {
          market: {
            type: "location",
            locationType: "Point"
          },
          description: {
            type: "string"
          },
          shop: {
            type: "location",
            locationType: "Point"
          }
        }
      },
      {
        title: "New Bucket2",
        properties: {
          home: {
            type: "location",
            locationType: "Point"
          }
        }
      },
      {
        title: "New Bucket3",
        properties: {
          title: {
            type: "string"
          }
        }
      }
    ]);

    const bucket1Docs = await db
      .collection(`bucket_${bucket1Id}`)
      .find<any>()
      .toArray()
      .then(docs =>
        docs.map(doc => {
          delete doc._id;
          return doc;
        })
      );

    expect(bucket1Docs).toEqual([
      {
        market: {
          type: "Point",
          // longitude first
          coordinates: [51, 50]
        },
        description: "some desc",
        shop: {
          type: "Point",
          coordinates: [101, 100]
        }
      },
      {
        market: {
          type: "Point",
          coordinates: [121, 120]
        },
        description: "some desc"
      }
    ]);
  });
});
