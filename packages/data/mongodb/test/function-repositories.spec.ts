import {Test} from "@nestjs/testing";
import {DuplicateKeyError} from "@spica-server/data";
import {
  MongoCollectionNames,
  MongoFunctionLogRepository,
  MongoFunctionRepository,
  MongoWebhookLogRepository
} from "@spica-server/data-mongodb";
import {DatabaseService, DatabaseTestingModule, ObjectId} from "@spica-server/database-testing";

describe("function repositories", () => {
  let db: DatabaseService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [DatabaseTestingModule.replicaSet()]
    }).compile();
    db = module.get(DatabaseService);
  });

  describe("functions", () => {
    let functions: MongoFunctionRepository;
    const fn = (name: string, extra: object = {}) =>
      ({name, language: "javascript", timeout: 10, triggers: {}, env_vars: [], ...extra}) as any;

    beforeEach(() => {
      functions = new MongoFunctionRepository(db, {} as any);
    });

    it("should read only the id, name and language of every function for summaries", async () => {
      await functions.insert(fn("a", {timeout: 5}));

      expect(await functions.findSummaries()).toEqual([
        {_id: expect.any(ObjectId), name: "a", language: "javascript"}
      ]);
    });

    it("should resolve updates and reference changes to the function as it was before", async () => {
      const envVarId = new ObjectId();
      const {_id} = await functions.insert(fn("a"));

      expect((await functions.updateById(_id, {timeout: 20})).timeout).toEqual(10);
      expect((await functions.addEnvVar(_id, envVarId)).env_vars).toEqual([]);
      expect(await functions.findReferencing("env_vars", envVarId)).toEqual([
        expect.objectContaining({_id})
      ]);
      expect((await functions.removeEnvVar(_id, envVarId)).env_vars).toEqual([envVarId]);
      expect((await functions.findById(_id)).env_vars).toEqual([]);
      expect(await functions.updateById(new ObjectId(), {timeout: 1})).toBeNull();
    });

    it("should apply merge patches and report patches that change nothing", async () => {
      const {_id, ...rest} = await functions.insert(fn("a", {category: "x"}));

      expect(await functions.applyMergePatch(_id, {}, rest)).toBeUndefined();
      expect(
        await functions.applyMergePatch(_id, {category: null, order: 1}, {...rest, order: 1})
      ).toEqual(expect.objectContaining({_id, order: 1}));
      expect((await functions.findById(_id)).category).toBeUndefined();
    });

    it("should report duplicate names as DuplicateKeyError", async () => {
      await db.collection("function").createIndex({name: 1}, {unique: true});
      await functions.insert(fn("a"));

      const error = await functions.insert(fn("a")).catch(e => e);

      expect(error).toBeInstanceOf(DuplicateKeyError);
      expect(error.keyValue).toEqual({name: "a"});
    });
  });

  it("should delete a function's logs within the range and levels", async () => {
    const logs = new MongoFunctionLogRepository(db, {expireAfterSeconds: 60} as any);
    const at = (iso: string) => ObjectId.createFromTime(new Date(iso).getTime() / 1000);
    await db.collection("function_logs").insertMany([
      {_id: at("2024-01-01T10:00:00Z"), function: "fn", level: 1},
      {_id: at("2024-01-01T11:00:00Z"), function: "fn", level: 2},
      {_id: at("2024-01-02T10:00:00Z"), function: "fn", level: 1},
      {_id: at("2024-01-01T10:30:00Z"), function: "other", level: 1}
    ]);

    const deleted = await logs.deleteByFunction("fn", {
      createdBetween: {
        from: new Date("2024-01-01T00:00:00Z"),
        to: new Date("2024-01-02T00:00:00Z")
      },
      levels: [1]
    });

    expect(deleted).toEqual(1);
    expect(await logs.deleteByFunction("fn")).toEqual(2);
    expect(await db.collection("function_logs").countDocuments()).toEqual(1);
  });

  it("should delete webhook logs by id", async () => {
    const logs = new MongoWebhookLogRepository(db, {expireAfterSeconds: 60});
    const {insertedIds} = await db
      .collection("webhook_logs")
      .insertMany([{webhook: "a"}, {webhook: "b"}, {webhook: "c"}]);

    expect(await logs.deleteById(insertedIds[0])).toEqual(1);
    expect(await logs.deleteByIds([insertedIds[1], insertedIds[2], new ObjectId()])).toEqual(2);
  });

  it("should list collection names", async () => {
    await db.createCollection("books");
    await db.createCollection("authors");

    expect((await new MongoCollectionNames(db).list()).sort()).toEqual(["authors", "books"]);
  });
});
