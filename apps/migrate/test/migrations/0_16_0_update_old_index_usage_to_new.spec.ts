import {Db, getConnectionUri, getDatabaseName, start} from "@spica-server/database/testing";
import color from "cli-color/lib/supports-color";
import {run} from "@spica/migrate";
import path from "path";

process.env.TESTONLY_MIGRATION_LOOKUP_DIR = path.join(process.cwd(), "dist/apps/migrate/src");

describe("Migrate index/unique flags into indexes array", () => {
  let db: Db;
  let args: string[];

  beforeAll(() => {
    color.disableColor();
  });

  beforeEach(async () => {
    const connection = await start("standalone");
    args = ["--database-uri", await getConnectionUri(), "--database-name", getDatabaseName()];
    db = connection.db(args[3]);

    await db.collection("bucket").insertMany([
      {
        title: "Bucket 1",
        properties: {
          title: {
            type: "string",
            options: {
              index: true,
              unique: true
            }
          },
          description: {
            type: "string",
            options: {
              index: true
            }
          }
        }
      },
      {
        title: "Bucket 2",
        properties: {
          name: {
            type: "string",
            options: {
              unique: true
            }
          },
          bio: {
            type: "string",
            options: {}
          }
        }
      }
    ]);
  });

  it("should migrate index/unique to 'indexes' array and strip old flags", async () => {
    await run([...args, "--from", "0.15.0", "--to", "0.16.0", "--continue-if-versions-are-equal"]);

    const buckets = await db.collection("bucket").find({}).toArray();

    expect(buckets[0]).toEqual({
      _id: buckets[0]._id,
      title: "Bucket 1",
      properties: {
        title: {type: "string", options: {}},
        description: {type: "string", options: {}}
      },
      indexes: [
        {definition: {title: 1}, options: {unique: true}},
        {definition: {description: 1}, options: {}}
      ]
    });

    expect(buckets[1]).toEqual({
      _id: buckets[1]._id,
      title: "Bucket 2",
      properties: {
        name: {type: "string", options: {}},
        bio: {type: "string", options: {}}
      },
      indexes: [{definition: {name: 1}, options: {unique: true}}]
    });
  });
});
