import {Db, getConnectionUri, getDatabaseName, start} from "@spica-server/database/testing";
import color from "cli-color/lib/supports-color";
import {run} from "@spica/migrate";
import path from "path";

process.env.TESTONLY_MIGRATION_LOOKUP_DIR = path.join(process.cwd(), "dist/apps/migrate/src");

describe("Add index to names of objects with the same name", () => {
  let db: Db;
  let args: string[];

  beforeAll(() => {
    color.disableColor();
  });

  beforeEach(async () => {
    const connection = await start("standalone");
    args = ["--database-uri", await getConnectionUri(), "--database-name", getDatabaseName()];
    db = connection.db(args[3]);
    await db.collection("storage").insertMany([
      {name: "my_obj.png", content: {data: "123", type: "0"}},
      {name: "my_obj_with_unique_name.png", content: {data: "1234", type: "1"}},
      {name: "my_obj.png", content: {data: "123", type: "0"}},
      {name: "my_obj.png", content: {data: "1234", type: "1"}},
      {name: "my_obj", content: {data: "12", type: "1"}},
      {name: "file.name.txt", content: {data: "123", type: "0"}},
      {name: "my_obj", content: {data: "123", type: "1"}},
      {name: "file.name.txt", content: {data: "1234", type: "0"}}
    ]);
  });

  it("should add index to object names", async () => {
    await run([...args, "--from", "0.9.29", "--to", "0.9.30", "--continue-if-versions-are-equal"]);
    const storage = await db
      .collection("storage")
      .find({})
      .map(obj => {
        delete obj._id;
        return obj;
      })
      .toArray();

    expect(storage).toEqual([
      {name: "my_obj.png", content: {data: "123", type: "0"}},
      {name: "my_obj_with_unique_name.png", content: {data: "1234", type: "1"}},
      {name: "my_obj(2).png", content: {data: "123", type: "0"}},
      {name: "my_obj(3).png", content: {data: "1234", type: "1"}},
      {name: "my_obj", content: {data: "12", type: "1"}},
      {name: "file.name.txt", content: {data: "123", type: "0"}},
      {name: "my_obj(2)", content: {data: "123", type: "1"}},
      {name: "file.name(2).txt", content: {data: "1234", type: "0"}}
    ]);
  });
});
