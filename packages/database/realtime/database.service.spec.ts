import {Test, TestingModule} from "@nestjs/testing";
import {
  DatabaseService,
  DatabaseTestingModule,
  ObjectId,
  stream
} from "@spica-server/database/testing";
import {Observable} from "rxjs";
import {bufferCount, delay, first, skip, take, takeUntil, tap} from "rxjs/operators";
import {RealtimeDatabaseService} from "@spica-server/database/realtime/database.service";
import {SequenceKind} from "@spica-server/database/realtime/levenshtein";
import {ChunkKind, FindOptions} from "@spica-server/database/realtime/interface";
import {Emitter} from "@spica-server/database/realtime/stream";

jasmine.DEFAULT_TIMEOUT_INTERVAL = 15000;

const LATENCY = 500;

const SKIP = new Object();

function wait(time: number = LATENCY) {
  return new Promise(resolve => setTimeout(resolve, time));
}

describe("realtime database", () => {
  let realtime: RealtimeDatabaseService;
  let database: DatabaseService;
  let bed: TestingModule;
  beforeEach(async () => {
    bed = await Test.createTestingModule({
      imports: [DatabaseTestingModule.replicaSet()],
      providers: [RealtimeDatabaseService]
    }).compile();

    realtime = bed.get(RealtimeDatabaseService);
    database = bed.get(DatabaseService);

    jasmine.addCustomEqualityTester((actual, expected) => {
      if (expected == SKIP) {
        return true;
      }
      if (
        (actual instanceof ObjectId && expected instanceof ObjectId) ||
        (typeof expected == "string" && actual instanceof ObjectId) ||
        (typeof actual == "string" && expected instanceof ObjectId)
      ) {
        return new ObjectId(actual).equals(expected);
      }
    });
  });

  afterEach(() => bed.close());

  it("should sync late subscribers", async done => {
    await database.collection("test21").insertMany([{stars: 3}, {stars: 4}, {stars: 5}]);
    const source = realtime.find("test21", {filter: {stars: {$gt: 3}}});
    const firstSubscription = source
      .pipe(
        bufferCount(3),
        take(1)
      )
      .subscribe({
        next: ([first, second, endofinitial]) => {
          expect(first.document.stars).toBe(4);
          expect(second.document.stars).toBe(5);
          expect(endofinitial).toEqual({kind: ChunkKind.EndOfInitial});
          const secondSubscription = source
            .pipe(
              bufferCount(3),
              take(1)
            )
            .subscribe({
              next: ([first, second, endofinitial]) => {
                expect(first.document.stars).toBe(4);
                expect(second.document.stars).toBe(5);
                expect(endofinitial).toEqual({kind: ChunkKind.EndOfInitial});
                secondSubscription.unsubscribe();
                firstSubscription.unsubscribe();
              }
            });
        },
        complete: () => done()
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

  describe("without filter, sort and limit", () => {
    it("should return inital value", done => {
      realtime
        .find("test")
        .pipe(first())
        .subscribe(data => {
          expect(data).toEqual({kind: ChunkKind.EndOfInitial});
          done();
        });
    });

    it("should return added document", async done => {
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
      await wait();
      await database.collection("test1").insertOne({test: 1});
    });

    it("should return initial and added document in order", async done => {
      const coll = database.collection("test2");
      await coll.insertOne({test: 1});
      realtime
        .find("test2")
        .pipe(
          take(4),
          bufferCount(4)
        )
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
      await wait();
      await coll.insertMany([{test: 2}, {test: 3}]);
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
      await wait();
      await coll.deleteOne({test: 3});
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
      await wait();
      await coll.findOneAndUpdate({test: 2}, {$set: {test: 4}});
    });
  });

  describe("with filter", () => {
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
      await wait();
      await database.collection("test6").insertMany([{stars: 6}, {stars: 7, anotherfilter: true}]);
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
      await wait();
      await coll.deleteOne({test: 3, has_star: false});
      await coll.deleteOne({test: 3, has_star: true});
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
      await wait();
      await coll.findOneAndUpdate({test: 2}, {$set: {test: 4}});
    });

    it("should expunge updated document if it does not match the filter anymore", async done => {
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
      await wait();
      await coll.findOneAndUpdate({_id: id}, {$set: {subfilter: false}});
    });

    it("should expunge updated document if it does not match the filter condition anymore", async done => {
      const coll = database.collection("test22");
      const id = await coll.insertOne({status: "active"}).then(r => r.insertedId);
      realtime
        .find("test22", {filter: {status: "active"}})
        .pipe(
          skip(2),
          take(1)
        )
        .subscribe(updated => {
          expect(updated).toEqual({kind: ChunkKind.Expunge, document: {_id: id}});
          done();
        });
      await wait();
      await coll.updateOne({_id: id}, {$set: {status: false}});
    });

    it("should expunge replaced document if it does not match the filter conditions anymore", async done => {
      const coll = database.collection("test10");
      const id = await coll.insertOne({test: 2, subfilter: true}).then(r => r.insertedId);
      realtime
        .find("test10", {filter: {subfilter: true, test: 2}})
        .pipe(
          skip(2),
          take(1)
        )
        .subscribe(updated => {
          expect(updated).toEqual({kind: ChunkKind.Expunge, document: {_id: id}});
          done();
        });
      await wait();
      await coll.findOneAndReplace({_id: id}, {test: 2, subfilter: false});
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
          bufferCount(7)
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

      await wait();
      laterInsertedId = await coll.insertOne({test: 7}).then(r => r.insertedId);
      await coll.findOneAndReplace({_id: laterInsertedId}, {test: 3});
      await coll.findOneAndUpdate({_id: laterInsertedId}, {$set: {test: 10}}).then(() => wait());
      await coll.deleteOne({_id: laterInsertedId});
      // These operations should not affect anything in our cursor
      await coll.updateOne({_id: insertedIds[1]}, {$set: {test: 25}});
      await coll.deleteOne({_id: insertedIds[1]});
      await wait();
      await coll.drop();
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
          bufferCount(7)
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
              {kind: ChunkKind.Initial, document: {_id: insertedIds[3], test: -1}}
            ]);
          },
          complete: () => {
            expect(totalEmit).toBe(7);
            done();
          }
        });

      await wait();
      await coll.findOneAndReplace({_id: insertedIds[1]}, {test: 3});
      await wait();
      await coll.findOneAndUpdate({_id: insertedIds[1]}, {$set: {test: 10}});
      await wait();
      await coll.deleteOne({_id: insertedIds[1]});
      await coll.deleteOne({_id: insertedIds[2]});
      await wait();
      // These operations should not affect anything in our cursor
      // They here to ensure correctness of our cursor despite the concurrent changes
      await coll.insertMany([{q: "do we rock?"}, {a: true}]);
      await coll.insertMany([{test: 12}, {test: 19.5}]);
      await wait();
      await coll.drop();
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
          bufferCount(5)
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
      await wait();
      await coll.deleteOne({_id: insertedIds[3]});
      await wait();
      await coll.drop();
    });
  });

  describe("with sort", () => {
    it("should order descending by id", async () => {
      const coll = database.collection("test14");
      const insertedIds = (await coll.insertMany([{test: 1}, {test: 2}, {test: 4}, {test: 5}]))
        .insertedIds;
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
      const insertedIds = (await coll.insertMany([{test: 1}, {test: 2}, {test: 4}, {test: 5}]))
        .insertedIds;

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
                  item: insertedIds[2],
                  with: insertedIds[0],
                  at: 2
                },
                {
                  kind: SequenceKind.Substitute,
                  item: insertedIds[0],
                  with: insertedIds[2],
                  at: 0
                }
              ]
            }
          ]);
          done();
        });
      await wait();
      await coll.updateOne({_id: insertedIds[2]}, {$set: {test: 1}});
      await coll.updateOne({_id: insertedIds[0]}, {$set: {test: 3}});
    });

    it("should order descending by _id property and limit to 2", async done => {
      const coll = database.collection("test17");
      const insertedId = await coll.insertOne({test: 1}).then(r => r.insertedId);
      realtime
        .find("test17", {sort: {_id: -1}, limit: 2})
        .pipe(bufferCount(4))
        .subscribe(chunks => {
          expect(chunks).toEqual([
            {kind: ChunkKind.Initial, document: {_id: insertedId, test: 1}},
            {kind: ChunkKind.EndOfInitial},
            {kind: ChunkKind.Insert, document: {_id: laterInsertedId, test: 2}},
            {
              kind: ChunkKind.Order,
              sequence: [
                {
                  kind: SequenceKind.Substitute,
                  item: laterInsertedId,
                  with: insertedId,
                  at: 1
                },
                {
                  kind: SequenceKind.Substitute,
                  item: insertedId,
                  with: laterInsertedId,
                  at: 0
                }
              ]
            }
          ]);
          done();
        });
      await wait(LATENCY);
      const laterInsertedId = (await coll.insertOne({test: 2})).insertedId;
    });

    it("should order descending by _id property and limit to one", async done => {
      const coll = database.collection("test18");
      const insertedId = await coll.insertOne({test: 1}).then(r => r.insertedId);
      realtime
        .find("test18", {sort: {_id: -1}, limit: 1})
        .pipe(bufferCount(4))
        .subscribe(chunks => {
          expect(chunks).toEqual([
            {kind: ChunkKind.Initial, document: {_id: insertedId, test: 1}},
            {kind: ChunkKind.EndOfInitial},
            {kind: ChunkKind.Insert, document: {_id: laterInsertedId, test: 2}},
            {
              kind: ChunkKind.Order,
              sequence: [
                {
                  kind: SequenceKind.Delete,
                  at: 0,
                  item: insertedId
                }
              ]
            }
          ]);
          done();
        });
      await wait(LATENCY);
      const laterInsertedId = (await coll.insertOne({test: 2})).insertedId;
    });

    it("should order descending by _id property and limit to one and expunge", async done => {
      const coll = database.collection("test19");
      const insertedId = await coll.insertOne({test: 1}).then(r => r.insertedId);
      realtime
        .find("test19", {sort: {_id: -1}, limit: 4})
        .pipe(bufferCount(10))
        .subscribe(chunks => {
          expect(chunks).toEqual([
            {kind: ChunkKind.Initial, document: {_id: insertedId, test: 1}},
            {kind: ChunkKind.EndOfInitial},
            {kind: ChunkKind.Insert, document: {_id: laterInsertedIds[2], test: 4}},
            {kind: ChunkKind.Insert, document: {_id: laterInsertedIds[1], test: 3}},
            {kind: ChunkKind.Insert, document: {_id: laterInsertedIds[0], test: 2}},
            // Move first added item to last
            {
              kind: ChunkKind.Order,
              sequence: [
                {kind: SequenceKind.Insert, item: insertedId, at: 3},
                {kind: SequenceKind.Delete, item: insertedId, at: 0}
              ]
            },
            {kind: ChunkKind.Insert, document: {_id: laterInsertedIds2[2], test: 7}},
            {kind: ChunkKind.Insert, document: {_id: laterInsertedIds2[1], test: 6}},
            {kind: ChunkKind.Insert, document: {_id: laterInsertedIds2[0], test: 5}},
            {
              kind: ChunkKind.Order,
              sequence: [
                {kind: SequenceKind.Insert, item: laterInsertedIds[2], at: 3},
                {kind: SequenceKind.Delete, item: insertedId, at: 3},
                {kind: SequenceKind.Delete, item: laterInsertedIds[0], at: 2},
                {kind: SequenceKind.Delete, item: laterInsertedIds[1], at: 1},
                {kind: SequenceKind.Delete, item: laterInsertedIds[2], at: 0}
              ]
            }
          ]);
          done();
        });
      await wait(LATENCY);
      const laterInsertedIds = (await coll.insertMany([{test: 2}, {test: 3}, {test: 4}]))
        .insertedIds;
      await wait(LATENCY);
      const laterInsertedIds2 = (await coll.insertMany([{test: 5}, {test: 6}, {test: 7}]))
        .insertedIds;
    });

    it("should order descending by _id property and limit to one and expunge", async done => {
      const coll = database.collection("test20");
      const initiallyInsertedIds = (await coll.insertMany([{test: 1}, {test: 2}])).insertedIds;
      realtime
        .find("test20", {sort: {_id: -1}, limit: 2})
        .pipe(bufferCount(6))
        .subscribe(chunks => {
          expect(chunks).toEqual([
            {kind: ChunkKind.Initial, document: {_id: initiallyInsertedIds[1], test: 2}},
            {kind: ChunkKind.Initial, document: {_id: initiallyInsertedIds[0], test: 1}},
            {kind: ChunkKind.EndOfInitial},
            {kind: ChunkKind.Insert, document: {_id: insertedIds[1], test: 4}},
            {kind: ChunkKind.Insert, document: {_id: insertedIds[0], test: 3}},
            {
              kind: ChunkKind.Order,
              sequence: [
                {kind: SequenceKind.Delete, item: initiallyInsertedIds[0], at: 1},
                {kind: SequenceKind.Delete, item: initiallyInsertedIds[1], at: 0}
              ]
            }
          ]);
          done();
        });
      await wait(LATENCY * 2);
      const insertedIds = (await coll.insertMany([{test: 3}, {test: 4}])).insertedIds;
    });
  });

  describe("changestream management", () => {
    describe("getChangeStream", () => {
      it("should create new change stream if it does not exist", async () => {
        const changestream = realtime["getChangeStream"]("bucket_coll");

        expect(changestream.isClosed()).toEqual(false);

        const existingChangeStreams = realtime["changeStreams"];
        expect(existingChangeStreams.size).toEqual(1);
        expect(existingChangeStreams.get("bucket_coll")).toEqual(changestream);
      });

      it("should get same change stream for the same collections", async () => {
        const changestream1 = realtime["getChangeStream"]("bucket_coll");
        const changestream2 = realtime["getChangeStream"]("bucket_coll");

        expect(changestream1).toEqual(changestream2);

        const existingChangeStreams = realtime["changeStreams"];
        expect(existingChangeStreams.size).toEqual(1);
        expect(existingChangeStreams.get("bucket_coll")).toEqual(changestream1);
        expect(existingChangeStreams.get("bucket_coll")).toEqual(changestream2);
      });
    });

    describe("getEmitter", () => {
      const collName = "bucket1";
      const options: FindOptions<any> = {
        filter: {title: "hey"},
        limit: 1,
        skip: 1,
        sort: {_id: 1}
      };
      it("should create new emitter", () => {
        const emitter = realtime["getEmitter"](collName, options);

        expect(emitter instanceof Emitter).toEqual(true);

        const emitters = realtime["emitters"];
        expect(emitters.size).toEqual(1);
        const emitterName = realtime.getUniqueEmitterName(collName, options);
        expect(emitters.get(emitterName)).toEqual({listenerCount: 1, value: emitter});

        const changeStreams = realtime["changeStreams"];
        expect(changeStreams.size).toEqual(1);
        expect(changeStreams.get(collName)).toEqual(
          emitter["changeStream"],
          "should work if change stream attached to desired emitter"
        );
      });

      it("should get existing emitter, increase listeners count", () => {
        const emitter = realtime["getEmitter"](collName, options);
        const emitter2 = realtime["getEmitter"](collName, options);

        expect(emitter).toEqual(emitter2);

        const emitters = realtime["emitters"];
        expect(emitters.size).toEqual(1);
        const emitterName = realtime.getUniqueEmitterName(collName, options);
        expect(emitters.get(emitterName)).toEqual({listenerCount: 2, value: emitter});
        expect(emitters.get(emitterName)).toEqual({listenerCount: 2, value: emitter2});

        const changeStreams = realtime["changeStreams"];
        expect(changeStreams.size).toEqual(1);
        expect(changeStreams.get(collName)).toEqual(emitter["changeStream"]);
        expect(changeStreams.get(collName)).toEqual(emitter2["changeStream"]);
      });
    });

    describe("getUniqueEmitterName", () => {
      it("should get unique name", () => {
        const name1 = realtime.getUniqueEmitterName("bucket1", {});
        expect(name1).toEqual("bucket1_{}");
      });
    });

    describe("findEmitterName", () => {
      it("should return undefined if emitter does not exist", () => {
        const emitterName = realtime["findEmitterName"]("bucket1", {});
        expect(emitterName).toEqual(undefined);
      });

      it("should return undefined if change stream exists but options are different", () => {
        realtime["getEmitter"]("bucket1", {limit: 1});

        const emitterName = realtime["findEmitterName"]("bucket1", {limit: 2});
        expect(emitterName).toEqual(undefined);
      });

      it("should return emitter name if it exists", () => {
        realtime["getEmitter"]("bucket1", {limit: 1});

        const emitterName = realtime["findEmitterName"]("bucket1", {limit: 1});
        expect(emitterName).toEqual('bucket1_{"limit":1}');
      });

      it("should return emitter name if it exists and has special type like Date, ObjectID", () => {
        const id = new ObjectId();
        const date = new Date();
        const options = {filter: {_id: id, created_at: date}};
        realtime["getEmitter"]("bucket1", options);

        const emitterName = realtime["findEmitterName"]("bucket1", options);
        const expectedEmitterName = realtime.getUniqueEmitterName("bucket1", options);
        expect(emitterName).toEqual(expectedEmitterName);
      });
    });

    describe("removeEmitter", () => {
      it("should only descrease listener count", () => {
        const coll = "bucket";
        const options = {limit: 1};

        realtime["getEmitter"](coll, options);
        realtime["getEmitter"](coll, options);

        realtime.removeEmitter(coll, options);

        const emitters = realtime["emitters"];
        const emitterName = realtime.getUniqueEmitterName("bucket", options);
        expect(emitters.get(emitterName).listenerCount).toEqual(1);

        const streams = realtime["changeStreams"];
        expect(streams.size).toEqual(1);
        expect(
          streams
            .values()
            .next()
            .value.isClosed()
        ).toEqual(false);
      });

      it("should remove emitter, close change stream", () => {
        const coll = "bucket";
        const options = {limit: 1};
        const emitter = realtime["getEmitter"](coll, options);
        const changeStream = emitter["changeStream"];

        realtime.removeEmitter(coll, options);

        const emitters = realtime["emitters"];
        expect(emitters.size).toEqual(0);

        const streams = realtime["changeStreams"];
        expect(streams.size).toEqual(0);

        expect(changeStream.isClosed()).toEqual(true);
      });

      it("should remove desired emitter but keep stream", () => {
        const coll = "bucket";
        const options = {limit: 1};
        const options2 = {limit: 2};

        const emitter = realtime["getEmitter"](coll, options);
        const emitter2 = realtime["getEmitter"](coll, options2);

        realtime.removeEmitter(coll, options);
        const emitters = realtime["emitters"];
        expect(emitters.size).toEqual(1);

        const emitterName = realtime.getUniqueEmitterName(coll, options);
        expect(emitters.get(emitterName)).toEqual(undefined);

        const emitterName2 = realtime.getUniqueEmitterName(coll, options2);
        expect(emitters.get(emitterName2)).toEqual({listenerCount: 1, value: emitter2});

        const streams = realtime["changeStreams"];
        expect(streams.size).toEqual(1);
      });
    });

    describe("find", () => {
      it("should get observable", async () => {
        const collName = "bucket";
        const options = {limit: 1};

        const obs = realtime.find(collName, options);
        expect(obs instanceof Observable).toEqual(true);

        expect(realtime["changeStreams"].size).toEqual(1);
        expect(realtime["emitters"].size).toEqual(1);
      });

      it("should get the existing observable", () => {
        const collName = "bucket";
        const options = {limit: 1};

        const obs = realtime.find(collName, options);
        const obs2 = realtime.find(collName, options);

        expect(obs).toEqual(obs2);

        expect(realtime["changeStreams"].size).toEqual(1);
        expect(realtime["emitters"].size).toEqual(1);
      });

      it("should get new observable", () => {
        const collName = "bucket";
        const options = {limit: 1};
        const options2 = {limit: 2};

        const obs = realtime.find(collName, options);
        const obs2 = realtime.find(collName, options2);

        expect(obs).not.toEqual(obs2);

        expect(realtime["changeStreams"].size).toEqual(1);
        expect(realtime["emitters"].size).toEqual(2);
      });
    });
  });
});
