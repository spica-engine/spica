import {Db, getConnectionUri, getDatabaseName, start} from "@spica-server/database/testing";
import color from "cli-color/lib/supports-color";
import {run} from "@spica/migrate";
import path from "path";
import {ObjectId} from "mongodb";

process.env.TESTONLY_MIGRATION_LOOKUP_DIR = path.join(process.cwd(), "dist/apps/migrate/src");

describe("Add timestamps to storage objects", () => {
  let db: Db;
  let args: string[];

  beforeAll(() => {
    color.disableColor();
  });

  beforeEach(async () => {
    const connection = await start("standalone");
    args = ["--database-uri", await getConnectionUri(), "--database-name", getDatabaseName()];
    db = connection.db(args[3]);
  });

  it("should add created_at and updated_at to storage objects without timestamps", async () => {
    const objectId1 = new ObjectId();
    const objectId2 = new ObjectId();
    const objectId3 = new ObjectId();

    const expectedTimestamp1 = new Date(objectId1.getTimestamp());
    const expectedTimestamp2 = new Date(objectId2.getTimestamp());
    const expectedTimestamp3 = new Date(objectId3.getTimestamp());

    await db.collection("storage").insertMany([
      {
        _id: objectId1,
        name: "file1.txt",
        url: "http://example.com/file1.txt",
        content: {data: "content1", type: "text/plain"}
      },
      {
        _id: objectId2,
        name: "file2.txt",
        url: "http://example.com/file2.txt",
        content: {data: "content2", type: "text/plain"}
      },
      {
        _id: objectId3,
        name: "file3.txt",
        url: "http://example.com/file3.txt",
        content: {data: "content3", type: "text/plain"}
      }
    ]);

    await run([...args, "--from", "0.15.0", "--to", "0.16.0", "--continue-if-versions-are-equal"]);

    const storage = await db.collection("storage").find({}).sort({name: 1}).toArray();

    expect(storage[0]).toEqual({
      _id: objectId1,
      name: "file1.txt",
      url: "http://example.com/file1.txt",
      content: {data: "content1", type: "text/plain"},
      created_at: expectedTimestamp1,
      updated_at: expectedTimestamp1
    });

    expect(storage[1]).toEqual({
      _id: objectId2,
      name: "file2.txt",
      url: "http://example.com/file2.txt",
      content: {data: "content2", type: "text/plain"},
      created_at: expectedTimestamp2,
      updated_at: expectedTimestamp2
    });

    expect(storage[2]).toEqual({
      _id: objectId3,
      name: "file3.txt",
      url: "http://example.com/file3.txt",
      content: {data: "content3", type: "text/plain"},
      created_at: expectedTimestamp3,
      updated_at: expectedTimestamp3
    });
  });
});
