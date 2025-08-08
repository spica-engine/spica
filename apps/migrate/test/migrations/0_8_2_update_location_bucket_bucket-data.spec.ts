import {Db, getConnectionUri, getDatabaseName, start} from "../../../../libs/database/testing";
import color from "cli-color/lib/supports-color";
import {run} from "@spica/migrate";
import path from "path";

process.env.TESTONLY_MIGRATION_LOOKUP_DIR = path.join(process.cwd(), "dist/apps/migrate/src");

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
      .find()
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
          coordinates: [50, 51]
        },
        description: "some desc",
        shop: {
          type: "Point",
          coordinates: [100, 101]
        }
      },
      {
        market: {
          type: "Point",
          coordinates: [120, 121]
        },
        description: "some desc"
      }
    ]);

    const bucket2Docs = await db
      .collection(`bucket_${bucket2Id}`)
      .find()
      .toArray()
      .then(docs =>
        docs.map(doc => {
          delete doc._id;
          return doc;
        })
      );

    expect(bucket2Docs).toEqual([
      {
        home: {
          type: "Point",
          coordinates: [null, null]
        }
      },
      {
        home: {
          type: "Point",
          coordinates: [131, 130]
        }
      }
    ]);

    const bucket3Docs = await db
      .collection(`bucket_${bucket3Id}`)
      .find()
      .toArray()
      .then(docs =>
        docs.map(doc => {
          delete doc._id;
          return doc;
        })
      );

    expect(bucket3Docs).toEqual([
      {
        title: "test"
      }
    ]);
  });
});
