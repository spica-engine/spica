import {Db, getConnectionUri, getDatabaseName, start} from "@spica-server/database-testing";
import color from "cli-color/lib/supports-color";
import {run} from "@spica/migrate";
import path from "path";

process.env.TESTONLY_MIGRATION_LOOKUP_DIR = path.join(process.cwd(), "dist/src");

jest.setTimeout(120_000);

describe("Remove position from bucket properties", () => {
  let db: Db;
  let args: string[];

  beforeAll(() => {
    color.disableColor();
  });

  beforeEach(async () => {
    const connection = await start("replset");
    args = ["--database-uri", await getConnectionUri(), "--database-name", getDatabaseName()];
    db = connection.db(args[3]);
  });

  it("should remove position from options while preserving other option fields", async () => {
    await db.collection("buckets").insertOne({
      title: "Test Bucket",
      description: "A test bucket",
      properties: {
        title: {
          type: "string",
          title: "title",
          options: {position: "left", translate: true, history: true}
        },
        description: {
          type: "textarea",
          title: "description",
          options: {position: "right", translate: false}
        }
      }
    });

    await run([...args, "--from", "0.17.0", "--to", "0.18.0", "--continue-if-versions-are-equal"]);

    const bucket = await db.collection("buckets").findOne({});
    expect(bucket.properties.title.options).toEqual({translate: true, history: true});
    expect(bucket.properties.description.options).toEqual({translate: false});
  });

  it("should remove position when it is the only option", async () => {
    await db.collection("buckets").insertOne({
      title: "Bucket With Position Only",
      description: "Position is the only option field",
      properties: {
        name: {
          type: "string",
          title: "name",
          options: {position: "bottom"}
        }
      }
    });

    await run([...args, "--from", "0.17.0", "--to", "0.18.0", "--continue-if-versions-are-equal"]);

    const bucket = await db.collection("buckets").findOne({});
    expect(bucket.properties.name.options).toEqual({});
    expect(bucket.properties.name.type).toBe("string");
    expect(bucket.properties.name.title).toBe("name");
  });

  it("should preserve nested fields and property structure", async () => {
    await db.collection("buckets").insertOne({
      title: "Nested Bucket",
      description: "Bucket with nested object properties",
      properties: {
        address: {
          type: "object",
          title: "address",
          options: {position: "left"},
          properties: {
            street: {
              type: "string",
              title: "street",
              options: {position: "right", translate: true}
            },
            city: {
              type: "string",
              title: "city",
              options: {position: "left"}
            }
          }
        },
        tags: {
          type: "array",
          title: "tags",
          options: {position: "bottom"},
          items: {
            type: "string"
          }
        }
      }
    });

    await run([...args, "--from", "0.17.0", "--to", "0.18.0", "--continue-if-versions-are-equal"]);

    const bucket = await db.collection("buckets").findOne({});

    expect(bucket.properties.address.options).toEqual({});
    expect(bucket.properties.address.type).toBe("object");
    expect(bucket.properties.address.properties).toEqual({
      street: {
        type: "string",
        title: "street",
        options: {translate: true}
      },
      city: {
        type: "string",
        title: "city",
        options: {}
      }
    });

    expect(bucket.properties.tags.options).toEqual({});
    expect(bucket.properties.tags.items).toEqual({type: "string"});
  });

  it("should handle properties without options", async () => {
    await db.collection("buckets").insertOne({
      title: "No Options Bucket",
      description: "Properties without options",
      properties: {
        name: {
          type: "string",
          title: "name"
        },
        age: {
          type: "number",
          title: "age",
          options: {position: "right"}
        }
      }
    });

    await run([...args, "--from", "0.17.0", "--to", "0.18.0", "--continue-if-versions-are-equal"]);

    const bucket = await db.collection("buckets").findOne({});
    expect(bucket.properties.name).toEqual({type: "string", title: "name"});
    expect(bucket.properties.age.options).toEqual({});
  });

  it("should handle multiple buckets", async () => {
    await db.collection("buckets").insertMany([
      {
        title: "Bucket One",
        description: "First bucket",
        properties: {
          field1: {type: "string", options: {position: "left", translate: true}},
          field2: {type: "number", options: {position: "right"}}
        }
      },
      {
        title: "Bucket Two",
        description: "Second bucket",
        properties: {
          fieldA: {type: "string", options: {position: "bottom"}}
        }
      },
      {
        title: "Bucket Three",
        description: "Third bucket with no position",
        properties: {
          fieldX: {type: "string", options: {translate: true}}
        }
      }
    ]);

    await run([...args, "--from", "0.17.0", "--to", "0.18.0", "--continue-if-versions-are-equal"]);

    const buckets = await db.collection("buckets").find({}).sort({title: 1}).toArray();

    expect(buckets[0].properties.field1.options).toEqual({translate: true});
    expect(buckets[0].properties.field2.options).toEqual({});

    // Alphabetical sort: Bucket One < Bucket Three < Bucket Two
    expect(buckets[1].properties.fieldX.options).toEqual({translate: true});

    expect(buckets[2].properties.fieldA.options).toEqual({});
  });
});
