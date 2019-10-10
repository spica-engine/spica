import {Test} from "@nestjs/testing";
import {DatabaseService, DatabaseTestingModule, ObjectId} from "@spica-server/database/testing";
import {timer} from "rxjs";
import {bufferCount, delay, first, skip, take, takeUntil, tap} from "rxjs/operators";
import {RealtimeDatabaseService} from "./database.service";
import {SequenceKind} from "./levenshtein";
import {ChunkKind} from "./stream";

jasmine.DEFAULT_TIMEOUT_INTERVAL = 8000;

function wait(time: number = 100) {
  return new Promise(resolve => setTimeout(resolve, time));
}

describe("realtime database", () => {
  let realtime: RealtimeDatabaseService;
  let database: DatabaseService;

  beforeAll(async () => {
    const bed = await Test.createTestingModule({
      imports: [DatabaseTestingModule.replicaSet()],
      providers: [RealtimeDatabaseService]
    }).compile();

    realtime = bed.get(RealtimeDatabaseService);
    database = bed.get(DatabaseService);

    jasmine.addCustomEqualityTester((actual, expected) => {
      if (actual instanceof ObjectId && expected instanceof ObjectId) {
        return actual.equals(expected);
      }
    });
  });

  it("should complete observable when collection dropped", async done => {
    await database.collection("willbedropped").insertMany([{test: 1}, {test: 2}]);
    realtime
      .find("willbedropped")
      .pipe(
        delay(100),
        take(1)
      )
      .subscribe(() => database.dropCollection("willbedropped"), undefined, () => done());
  });

  describe("without match, sort and limit", () => {
    it("should return inital value", done => {
      realtime
        .find("test")
        .pipe(first())
        .subscribe(data => {
          expect(data).toEqual({kind: ChunkKind.EndOfInitial});
          done();
        });
    });

    it("should return added document", done => {
      realtime
        .find("test1")
        .pipe(
          skip(1),
          take(1)
        )
        .subscribe(data => {
          expect(data.kind).toBe(ChunkKind.Insert);
          expect(data.document.test).toBe(1);
          done();
        });

      setTimeout(() => {
        database.collection("test1").insertOne({test: 1});
      }, 100);
    });

    it("should return initial and added document in order", async done => {
      const coll = database.collection("test2");
      await coll.insertOne({test: 1});
      realtime
        .find("test2")
        .pipe(bufferCount(4))
        .subscribe(([initial, endofinitial, firstInsert, secondInsert]) => {
          expect(initial.kind).toBe(ChunkKind.Initial);
          expect(initial.document.test).toBe(1);
          expect(endofinitial.kind).toBe(ChunkKind.EndOfInitial);
          expect(firstInsert.kind).toBe(ChunkKind.Insert);
          expect(firstInsert.document.test).toBe(2);
          expect(secondInsert.kind).toBe(ChunkKind.Insert);
          expect(secondInsert.document.test).toBe(3);
          done();
        });
      setTimeout(() => {
        coll.insertMany([{test: 2}, {test: 3}]);
      }, 500);
    });

    it("should return deleted document", async done => {
      const coll = database.collection("test3");
      const inserted = await coll.insertMany([{test: 2}, {test: 3}]);
      realtime
        .find("test3")
        .pipe(
          skip(3),
          take(1)
        )
        .subscribe(deleted => {
          expect(deleted.kind).toBe(ChunkKind.Delete);
          expect(inserted.insertedIds[1].equals(deleted.document._id)).toBeTruthy();
          done();
        });
      setTimeout(() => {
        coll.deleteOne({test: 3});
      }, 1);
    });

    it("should return edited document", async done => {
      const coll = database.collection("test4");
      await coll.insertOne({test: 2});
      realtime
        .find("test4")
        .pipe(
          skip(2),
          take(1)
        )
        .subscribe(updated => {
          expect(updated.kind).toBe(ChunkKind.Update);
          expect(updated.document.test).toBe(4);
          done();
        });
      setTimeout(() => {
        coll.findOneAndUpdate({test: 2}, {$set: {test: 4}});
      }, 1);
    });
  });

  describe("with query", () => {
    it("should return inital value", async done => {
      await database.collection("test5").insertMany([{stars: 3}, {stars: 4}, {stars: 5}]);
      realtime
        .find("test5", {filter: {stars: {$gt: 3}}})
        .pipe(bufferCount(3))
        .subscribe(([first, second, endofinitial]) => {
          expect(first.document.stars).toBe(4);
          expect(second.document.stars).toBe(5);
          expect(endofinitial).toEqual({kind: ChunkKind.EndOfInitial});
          done();
        });
    });

    it("should return added documents", async done => {
      await database
        .collection("test6")
        .insertMany([{stars: 3}, {stars: 4, anotherfilter: true}, {stars: 5, anotherfilter: true}]);
      realtime
        .find("test6", {filter: {stars: {$gt: 3}, anotherfilter: true}})
        .pipe(bufferCount(4))
        .subscribe(([first, second, endofinitial, third]) => {
          expect(first.document.stars).toBe(4);
          expect(second.document.stars).toBe(5);
          expect(endofinitial).toEqual({kind: ChunkKind.EndOfInitial});
          expect(third.document.stars).toBe(7);
          expect(third.document.anotherfilter).toBe(true);
          done();
        });
      setTimeout(() => {
        database.collection("test6").insertMany([{stars: 6}, {stars: 7, anotherfilter: true}]);
      }, 1);
    });

    it("should return deleted document", async done => {
      const coll = database.collection("test7");
      const inserted = await coll.insertMany([
        {test: 2, has_star: true},
        {test: 3, has_star: true},
        {test: 3, has_star: false}
      ]);
      realtime
        .find("test7", {filter: {has_star: true}})
        .pipe(
          skip(3),
          take(1)
        )
        .subscribe(deleted => {
          expect(deleted.kind).toBe(ChunkKind.Delete);
          expect(inserted.insertedIds[1].equals(deleted.document._id)).toBeTruthy();
          done();
        });
      setTimeout(async () => {
        await coll.deleteOne({test: 3, has_star: false});
        await coll.deleteOne({test: 3, has_star: true});
      }, 1);
    });

    it("should return edited document", async done => {
      const coll = database.collection("test8");
      await coll.insertOne({test: 2, subfilter: true});
      realtime
        .find("test8", {filter: {subfilter: true}})
        .pipe(
          skip(2),
          take(1)
        )
        .subscribe(updated => {
          expect(updated.kind).toBe(ChunkKind.Update);
          expect(updated.document.test).toBe(4);
          done();
        });
      setTimeout(() => {
        coll.findOneAndUpdate({test: 2}, {$set: {test: 4}});
      }, 1);
    });

    it("should return updated document if it does not match with filter anymore", async done => {
      const coll = database.collection("test9");
      const id = await coll.insertOne({test: 2, subfilter: true}).then(r => r.insertedId);
      realtime
        .find("test9", {filter: {subfilter: true}})
        .pipe(
          skip(2),
          take(1)
        )
        .subscribe(updated => {
          expect(updated).toEqual({kind: ChunkKind.Expunge, document: {_id: id}});
          done();
        });
      setTimeout(() => {
        coll.findOneAndUpdate({_id: id}, {$set: {subfilter: false}});
      }, 1);
    });

    it("should return replaced document if it does not match with filter anymore", async done => {
      const coll = database.collection("test10");
      const id = await coll.insertOne({test: 2, subfilter: true}).then(r => r.insertedId);
      realtime
        .find("test10", {filter: {subfilter: true}})
        .pipe(
          skip(2),
          take(1)
        )
        .subscribe(updated => {
          expect(updated).toEqual({kind: ChunkKind.Expunge, document: {_id: id}});
          done();
        });
      setTimeout(() => {
        coll.findOneAndReplace({_id: id}, {test: 2, subfilter: false});
      }, 1);
    });
  });

  describe("with skip/limit", () => {
    it("should skip N items", async done => {
      const coll = database.collection("test11");
      const insertedIds = await coll
        .insertMany([{test: 2}, {test: 2}, {test: 4}, {test: 5}])
        .then(r => r.insertedIds);
      let totalEmit = 0;
      let laterInsertedId: ObjectId;
      realtime
        .find("test11", {skip: 2})
        .pipe(
          tap(() => (totalEmit += 1)),
          bufferCount(7),
          takeUntil(timer(500))
        )
        .subscribe({
          next: chunks => {
            expect(chunks).toEqual([
              {kind: ChunkKind.Initial, document: {_id: insertedIds[2], test: 4}},
              {kind: ChunkKind.Initial, document: {_id: insertedIds[3], test: 5}},
              {kind: ChunkKind.EndOfInitial},
              {kind: ChunkKind.Insert, document: {_id: laterInsertedId, test: 7}},
              {kind: ChunkKind.Replace, document: {_id: laterInsertedId, test: 3}},
              {kind: ChunkKind.Update, document: {_id: laterInsertedId, test: 10}},
              {kind: ChunkKind.Delete, document: {_id: laterInsertedId}}
            ]);
          },
          complete: () => {
            expect(totalEmit).toBe(7);
            done();
          }
        });

      setTimeout(async () => {
        laterInsertedId = await coll.insertOne({test: 7}).then(r => r.insertedId);
        await coll.findOneAndReplace({_id: laterInsertedId}, {test: 3});
        await coll.findOneAndUpdate({_id: laterInsertedId}, {$set: {test: 10}}).then(() => wait());
        await coll.deleteOne({_id: laterInsertedId});
        // These operations should not affect anything in our cursor
        await coll.updateOne({_id: insertedIds[1]}, {$set: {test: 25}});
        await coll.deleteOne({_id: insertedIds[1]});
      }, 1);
    });

    it("should limit to N items", async done => {
      const coll = database.collection("test12");
      const insertedIds = await coll
        .insertMany([{test: 1}, {test: 7}, {test: 2}, {test: -1}])
        .then(r => r.insertedIds);
      let totalEmit = 0;
      realtime
        .find("test12", {limit: 2})
        .pipe(
          tap(() => (totalEmit += 1)),
          bufferCount(9),
          takeUntil(timer(500))
        )
        .subscribe({
          next: chunks => {
            expect(chunks).toEqual([
              {kind: ChunkKind.Initial, document: {_id: insertedIds[0], test: 1}},
              {kind: ChunkKind.Initial, document: {_id: insertedIds[1], test: 7}},
              {kind: ChunkKind.EndOfInitial},
              {kind: ChunkKind.Replace, document: {_id: insertedIds[1], test: 3}},
              {kind: ChunkKind.Update, document: {_id: insertedIds[1], test: 10}},
              {kind: ChunkKind.Delete, document: {_id: insertedIds[1]}},
              {kind: ChunkKind.Initial, document: {_id: insertedIds[3], test: 18}}
            ]);
          },
          complete: () => {
            expect(totalEmit).toBe(7);
            done();
          }
        });

      setTimeout(async () => {
        await coll.findOneAndReplace({_id: insertedIds[1]}, {test: 3});
        await coll.findOneAndUpdate({_id: insertedIds[1]}, {$set: {test: 10}}).then(() => wait());
        await coll.deleteOne({_id: insertedIds[1]});
        await coll.insertMany([{q: "do we rock?"}, {a: true}]).then(r => r.insertedIds[0]);
        // These operations should not affect anything in our cursor
        await coll.insertMany([{test: 12}, {test: 19.5}]);
        await coll.deleteOne({_id: insertedIds[2]});
      }, 1);
    });

    it("should skip and limit to N items", async done => {
      const coll = database.collection("test13");
      const insertedIds = await coll
        .insertMany([{test: 1}, {test: 7}, {test: 2}, {test: true}, {test: "test"}])
        .then(r => r.insertedIds);
      let totalEmit = 0;
      realtime
        .find("test13", {limit: 2, skip: 2})
        .pipe(
          tap(() => (totalEmit += 1)),
          bufferCount(5),
          takeUntil(timer(500))
        )
        .subscribe({
          next: chunks => {
            expect(chunks).toEqual([
              {kind: ChunkKind.Initial, document: {_id: insertedIds[2], test: 2}},
              {kind: ChunkKind.Initial, document: {_id: insertedIds[3], test: true}},
              {kind: ChunkKind.EndOfInitial},
              {kind: ChunkKind.Delete, document: {_id: insertedIds[3]}},
              {kind: ChunkKind.Initial, document: {_id: insertedIds[4], test: "test"}}
            ]);
          },
          complete: () => {
            expect(totalEmit).toBe(5);
            done();
          }
        });

      setTimeout(async () => {
        await coll.deleteOne({_id: insertedIds[3]});
      }, 1);
    });
  });

  describe("with sort", () => {
    it("should order descending by id", async () => {
      const coll = database.collection("test14");
      const insertedIds = await coll
        .insertMany([{test: 1}, {test: 2}, {test: 4}, {test: 5}])
        .then(r => r.insertedIds);

      realtime
        .find("test14", {sort: {_id: -1}})
        .pipe(bufferCount(5))
        .subscribe(chunks => {
          expect(chunks).toEqual([
            {kind: ChunkKind.Initial, document: {_id: insertedIds[3], test: 5}},
            {kind: ChunkKind.Initial, document: {_id: insertedIds[2], test: 4}},
            {kind: ChunkKind.Initial, document: {_id: insertedIds[1], test: 2}},
            {kind: ChunkKind.Initial, document: {_id: insertedIds[0], test: 1}},
            {kind: ChunkKind.EndOfInitial}
          ]);
        });
    });

    it("should order ascending by id", async () => {
      const coll = database.collection("test15");
      const insertedIds = await coll
        .insertMany([{test: 1}, {test: 2}, {test: 4}, {test: 5}])
        .then(r => r.insertedIds);

      realtime
        .find("test15", {sort: {_id: 1}})
        .pipe(bufferCount(5))
        .subscribe(chunks => {
          expect(chunks).toEqual([
            {kind: ChunkKind.Initial, document: {_id: insertedIds[0], test: 1}},
            {kind: ChunkKind.Initial, document: {_id: insertedIds[1], test: 2}},
            {kind: ChunkKind.Initial, document: {_id: insertedIds[2], test: 4}},
            {kind: ChunkKind.Initial, document: {_id: insertedIds[3], test: 5}},
            {kind: ChunkKind.EndOfInitial}
          ]);
        });
    });

    it("should order descending by number property", async done => {
      const coll = database.collection("test16");
      const insertedIds = await coll
        .insertMany([{test: 1}, {test: 2}, {test: 3}])
        .then(r => r.insertedIds);

      realtime
        .find("test16", {sort: {test: 1}})
        .pipe(bufferCount(7))
        .subscribe(chunks => {
          expect(chunks).toEqual([
            {kind: ChunkKind.Initial, document: {_id: insertedIds[0], test: 1}},
            {kind: ChunkKind.Initial, document: {_id: insertedIds[1], test: 2}},
            {kind: ChunkKind.Initial, document: {_id: insertedIds[2], test: 3}},
            {kind: ChunkKind.EndOfInitial},
            {kind: ChunkKind.Update, document: {_id: insertedIds[2], test: 1}},
            {kind: ChunkKind.Update, document: {_id: insertedIds[0], test: 3}},
            {
              kind: ChunkKind.Order,
              sequence: [
                {
                  kind: SequenceKind.Substitute,
                  item: insertedIds[0].toHexString(),
                  with: insertedIds[2].toHexString(),
                  at: 0
                },
                {
                  kind: SequenceKind.Substitute,
                  item: insertedIds[2].toHexString(),
                  with: insertedIds[0].toHexString(),
                  at: 2
                }
              ]
            }
          ]);
          done();
        });
      setTimeout(async () => {
        await coll.updateOne({_id: insertedIds[2]}, {$set: {test: 1}});
        await coll.updateOne({_id: insertedIds[0]}, {$set: {test: 3}});
      }, 1);
    });
  });
});
