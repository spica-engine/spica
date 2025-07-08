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
    const connection = await start("replset");
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

    const buckets = await db
      .collection("bucket")
      .find({})
      .project({indexes: 1, properties: 1})
      .toArray();

    expect(buckets[0].indexes).toEqual([
      {
        definition: {title: 1},
        options: {unique: true}
      },
      {
        definition: {description: 1},
        options: {}
      }
    ]);

    expect(buckets[0].properties.title.options.index).toBeUndefined();
    expect(buckets[0].properties.title.options.unique).toBeUndefined();
    expect(buckets[0].properties.description.options.index).toBeUndefined();

    expect(buckets[1].indexes).toEqual([
      {
        definition: {name: 1},
        options: {unique: true}
      }
    ]);
    expect(buckets[1].properties.name.options.index).toBeUndefined();
    expect(buckets[1].properties.name.options.unique).toBeUndefined();
    expect(buckets[1].properties.bio.options).toEqual({});
  });
});
