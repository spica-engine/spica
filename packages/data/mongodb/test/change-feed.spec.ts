import {Test} from "@nestjs/testing";
import {MongoChangeFeed} from "@spica-server/data-mongodb";
import {DatabaseService, DatabaseTestingModule, stream} from "@spica-server/database-testing";
import {ChangeEvent} from "@spica-server/interface-data";
import {EventEmitter} from "events";
import {Subscription, take, toArray} from "rxjs";

describe("MongoChangeFeed", () => {
  let db: DatabaseService;
  let feed: MongoChangeFeed;
  let subscription: Subscription;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [DatabaseTestingModule.replicaSet()]
    }).compile();
    db = module.get(DatabaseService);
    feed = new MongoChangeFeed(db);
    await db.createCollection("items");
  });

  afterEach(() => subscription?.unsubscribe());

  function collect(count: number, ...args: Parameters<MongoChangeFeed["watch"]>) {
    const changes: Promise<ChangeEvent[]> = new Promise((resolve, reject) => {
      subscription = feed
        .watch(...args)
        .pipe(take(count), toArray())
        .subscribe({next: resolve, error: reject});
    });
    return changes;
  }

  it("should open a change stream with a single operation as plain equality", async () => {
    collect(1, "items", {operations: ["insert"], document: "current"});

    const [collection, pipeline, options] = await stream.wait();

    expect(collection).toEqual("items");
    expect(pipeline).toEqual([{$match: {operationType: "insert"}}]);
    expect(options).toMatchObject({fullDocument: "updateLookup"});
  });

  it("should emit only the requested operations", async () => {
    const changes = collect(2, "items", {operations: ["insert", "delete"]});
    await stream.wait();

    const {insertedId} = await db.collection("items").insertOne({a: 1});
    await db.collection("items").updateOne({_id: insertedId}, {$set: {a: 2}});
    await db.collection("items").deleteOne({_id: insertedId});

    expect((await changes).map(change => change.operationType)).toEqual(["insert", "delete"]);
  });

  it("should attach the current document to updates only when asked", async () => {
    const {insertedId} = await db.collection("items").insertOne({a: 1});
    const withDocument = collect(1, "items", {operations: ["update"], document: "current"});
    await stream.wait();

    await db.collection("items").updateOne({_id: insertedId}, {$set: {a: 2}});

    const [change] = await withDocument;
    expect(change.fullDocument).toEqual({_id: insertedId, a: 2});
    expect(change.documentKey).toEqual({_id: insertedId});
    expect(change.ns.coll).toEqual("items");
    expect(change.updateDescription.updatedFields).toEqual({a: 2});
    expect(change._id._data).toEqual(expect.any(String));
  });

  it("should attach the document before the change when the collection records it", async () => {
    await db.command({collMod: "items", changeStreamPreAndPostImages: {enabled: true}});
    const {insertedId} = await db.collection("items").insertOne({a: 1});
    const changes = collect(1, "items", {operations: ["delete"], beforeChange: "whenAvailable"});
    await stream.wait();

    await db.collection("items").deleteOne({_id: insertedId});

    expect((await changes)[0].fullDocumentBeforeChange).toEqual({_id: insertedId, a: 1});
  });

  describe("lifecycle", () => {
    function fakeDatabase() {
      const changeStream = Object.assign(new EventEmitter(), {
        closed: false,
        close: jest.fn(() => {
          changeStream.closed = true;
          return Promise.resolve();
        })
      });
      const watch = jest.fn(() => changeStream);
      const database = {changeStreamAwaitTimeMS: 5, collection: jest.fn(() => ({watch}))};
      return {changeStream, watch, database};
    }

    it("should open the stream on subscription and close it on unsubscribe", () => {
      const {changeStream, watch, database} = fakeDatabase();
      const changes = new MongoChangeFeed(database as any).watch("items");

      expect(watch).not.toHaveBeenCalled();
      subscription = changes.subscribe();
      expect(watch).toHaveBeenCalledWith([], {maxAwaitTimeMS: 5});

      subscription.unsubscribe();
      subscription.unsubscribe();

      expect(changeStream.close).toHaveBeenCalledTimes(1);
    });

    it("should forward change stream errors", () => {
      const {changeStream, database} = fakeDatabase();
      const error = jest.fn();
      subscription = new MongoChangeFeed(database as any).watch("items").subscribe({error});

      changeStream.emit("error", new Error("cursor killed"));

      expect(error).toHaveBeenCalledWith(new Error("cursor killed"));
    });
  });
});
