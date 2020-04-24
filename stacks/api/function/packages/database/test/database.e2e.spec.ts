import {Test, TestingModule} from "@nestjs/testing";
import {database, connected, close} from "@spica-devkit/database";
import {DatabaseService, DatabaseTestingModule} from "@spica-server/database/testing";
import {Db} from "mongodb";

describe("Database e2e", () => {
  let module: TestingModule;
  let db: DatabaseService;
  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [DatabaseTestingModule.create()]
    }).compile();
    db = module.get(DatabaseService);
    const {host, port} = db.serverConfig["s"];
    process.env.__INTERNAL__SPICA__MONGOURL__ = `mongodb://${host}:${port}`;
    process.env.__INTERNAL__SPICA__MONGODBNAME__ = db.databaseName;
  });

  afterAll(async () => await module.close());

  afterEach(async () => await db.dropDatabase());

  it("should connect to database", async () => {
    const db = await database();

    expect(db instanceof Db).toBe(true);
    expect(await connected()).toBe(true);
  });

  it("should close the connection to the database", async () => {
    const _ = await database();
    expect(connected()).toBe(true);
    await close();
    expect(connected()).toBe(false);
  });

  it("should write to database", async () => {
    const db = await database();
    const coll = db.collection("test");
    let data = await coll.find({}).toArray();
    expect(data.length).toBe(0);
    await coll.insertOne({
      test: 1
    });
    data = await coll.find({}).toArray();
    expect(data.length).toBe(1);
    expect(db instanceof Db).toBe(true);
  });
});
