import {
  Db,
  getConnectionUri,
  getDatabaseName,
  ObjectId,
  start
} from "@spica-server/database/testing";
import * as color from "cli-color/lib/supports-color";
import {run} from "@spica/migrate/src/main";

describe("add root prefix to all storage objects", () => {
  let db: Db;
  let args: string[];
  let storageIds: ObjectId[] = [];

  beforeAll(() => {
    color.disableColor();
  });

  beforeEach(async () => {
    const connection = await start("replset");
    args = ["--database-uri", await getConnectionUri(), "--database-name", getDatabaseName()];
    db = connection.db(args[3]);
    await db
      .collection("storage")
      .insertMany([
        {
          name: "file1.txt",
          url: "some_url",
          content: {
            type: "text/plain",
            size: 10
          }
        },
        {
          name: "file2.txt",
          url: "some_other_url",
          content: {
            type: "application/json",
            size: 200
          }
        }
      ])
      .then(r => (storageIds = Object.values(r.insertedIds)));
  });

  it("should add root prefix to all storage objects", async () => {
    await run([...args, "--from", "0.9.25", "--to", "0.9.26", "--continue-if-versions-are-equal"]);
    const storages = await db
      .collection("storage")
      .find({})
      .sort({_id: -1})
      .toArray();
    delete storages[0]._id;

    expect(storages).toEqual([
      {
        name: "root/",
        content: {
          type: "",
          size: 0
        }
      },
      {
        _id: storageIds[1],
        name: "root/file2.txt",
        url: "some_other_url",
        content: {
          type: "application/json",
          size: 200
        }
      },
      {
        _id: storageIds[0],
        name: "root/file1.txt",
        url: "some_url",
        content: {
          type: "text/plain",
          size: 10
        }
      }
    ]);
  });
});
