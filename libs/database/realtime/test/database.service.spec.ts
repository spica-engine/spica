import {Test, TestingModule} from "@nestjs/testing";
import {DatabaseService, DatabaseTestingModule, ObjectId} from "@spica-server/database/testing";
import {bufferCount, delay, first, skip, take, tap} from "rxjs/operators";
import {RealtimeDatabaseService} from "@spica-server/database/realtime/src/database.service";
import {ChunkKind, SequenceKind} from "@spica-server/interface/realtime";

const LATENCY = 500;

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
  });

  afterEach(() => bed.close());

  it("should sync late subscribers", async () => {
    await database.collection("test21").insertMany([{stars: 3}, {stars: 4}, {stars: 5}]);
    const source = realtime.find("test21", {filter: {stars: {$gt: 3}}});

    let [first, second, endofinitial] = await source
      .pipe(
        bufferCount(3),
        take(1)
      )
      .toPromise();
    expect(first.document.stars).toBe(4);
    expect(second.document.stars).toBe(5);
    expect(endofinitial).toEqual({kind: ChunkKind.EndOfInitial});

    [first, second, endofinitial] = await source
      .pipe(
        bufferCount(3),
        take(1)
      )
      .toPromise();
    expect(first.document.stars).toBe(4);
    expect(second.document.stars).toBe(5);
    expect(endofinitial).toEqual({kind: ChunkKind.EndOfInitial});
  });

  it("should complete observable when collection dropped", done => {
    database
      .collection("willbedropped")
      .insertMany([{test: 1}, {test: 2}])
      .then(() => {
        realtime
          .find("willbedropped")
          .pipe(
            delay(100),
            take(1)
          )
          .subscribe(() => database.dropCollection("willbedropped"), undefined, () => done());
      });
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
      wait().then(() => database.collection("test1").insertOne({test: 1}));
    });

    it("should return initial and added document in order", done => {
      const coll = database.collection("test2");
      coll.insertOne({test: 1}).then(() => {
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
        wait().then(() => coll.insertMany([{test: 2}, {test: 3}]));
      });
    });

    it("should return deleted document", done => {
      const coll = database.collection("test3");
      coll.insertMany([{test: 2}, {test: 3}]).then(inserted => {
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
        wait().then(() => coll.deleteOne({test: 3}));
      });
    });

    it("should return edited document", done => {
      const coll = database.collection("test4");
      coll.insertOne({test: 2}).then(() => {
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
        wait().then(() => coll.findOneAndUpdate({test: 2}, {$set: {test: 4}}));
      });
    });
  });

  describe("with filter", () => {
    it("should return inital value", done => {
      database
        .collection("test5")
        .insertMany([{stars: 3}, {stars: 4}, {stars: 5}])
        .then(() => {
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
    });

    it("should return added documents", done => {
      database
        .collection("test6")
        .insertMany([{stars: 3}, {stars: 4, anotherfilter: true}, {stars: 5, anotherfilter: true}])
        .then(() => {
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
          wait().then(() =>
            database.collection("test6").insertMany([{stars: 6}, {stars: 7, anotherfilter: true}])
          );
        });
    });

    it("should return deleted document", done => {
      const coll = database.collection("test7");
      coll
        .insertMany([
          {test: 2, has_star: true},
          {test: 3, has_star: true},
          {test: 3, has_star: false}
        ])
        .then(inserted => {
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
          wait().then(() =>
            coll
              .deleteOne({test: 3, has_star: false})
              .then(() => coll.deleteOne({test: 3, has_star: true}))
          );
        });
    });

    it("should return edited document", done => {
      const coll = database.collection("test8");
      coll.insertOne({test: 2, subfilter: true}).then(() => {
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
        wait().then(() => coll.findOneAndUpdate({test: 2}, {$set: {test: 4}}));
      });
    });

    it("should expunge updated document if it does not match the filter anymore", done => {
      const coll = database.collection("test9");
      coll
        .insertOne({test: 2, subfilter: true})
        .then(r => r.insertedId)
        .then(id => {
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
          wait().then(() => coll.findOneAndUpdate({_id: id}, {$set: {subfilter: false}}));
        });
    });

    it("should expunge updated document if it does not match the filter condition anymore", done => {
      const coll = database.collection("test22");
      coll
        .insertOne({status: "active"})
        .then(r => r.insertedId)
        .then(id => {
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
          wait().then(() => coll.updateOne({_id: id}, {$set: {status: false}}));
        });
    });

    it("should expunge replaced document if it does not match the filter conditions anymore", done => {
      const coll = database.collection("test10");
      coll
        .insertOne({test: 2, subfilter: true})
        .then(r => r.insertedId)
        .then(id => {
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
          wait().then(() => coll.findOneAndReplace({_id: id}, {test: 2, subfilter: false}));
        });
    });
  });

  describe("with skip/limit", () => {
    it("should skip N items", done => {
      const coll = database.collection("test11");
      coll.insertMany([{test: 2}, {test: 2}, {test: 4}, {test: 5}]).then(({insertedIds}) => {
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
        wait().then(() =>
          coll
            .insertOne({test: 7})
            .then(r => r.insertedId)
            .then(_laterInsertedId => {
              laterInsertedId = _laterInsertedId;
              coll.findOneAndReplace({_id: laterInsertedId}, {test: 3}).then(() =>
                coll.findOneAndUpdate({_id: laterInsertedId}, {$set: {test: 10}}).then(() =>
                  wait().then(() =>
                    coll.deleteOne({_id: laterInsertedId}).then(() =>
                      // These operations should not affect anything in our cursor
                      Promise.all([
                        coll.updateOne({_id: insertedIds[1]}, {$set: {test: 25}}),
                        coll.deleteOne({_id: insertedIds[1]})
                      ]).then(() => wait().then(() => coll.drop()))
                    )
                  )
                )
              );
            })
        );
      });
    });

    it("should limit to N items", done => {
      const coll = database.collection("test12");
      coll
        .insertMany([{test: 1}, {test: 7}, {test: 2}, {test: -1}])
        .then(r => r.insertedIds)
        .then(insertedIds => {
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
          wait().then(() =>
            coll.findOneAndReplace({_id: insertedIds[1]}, {test: 3}).then(() =>
              wait().then(() =>
                coll.findOneAndUpdate({_id: insertedIds[1]}, {$set: {test: 10}}).then(() =>
                  wait().then(() =>
                    coll.deleteOne({_id: insertedIds[1]}).then(() =>
                      coll.deleteOne({_id: insertedIds[2]}).then(() =>
                        wait().then(() =>
                          // These operations should not affect anything in our cursor
                          // They here to ensure correctness of our cursor despite the concurrent changes
                          Promise.all([
                            coll.insertMany([{q: "do we rock?"}, {a: true}]),
                            coll.insertMany([{test: 12}, {test: 19.5}])
                          ]).then(() => wait().then(() => coll.drop()))
                        )
                      )
                    )
                  )
                )
              )
            )
          );
        });
    });

    it("should skip and limit to N items", done => {
      const coll = database.collection("test13");
      coll
        .insertMany([{test: 1}, {test: 7}, {test: 2}, {test: true}, {test: "test"}])
        .then(({insertedIds}) => {
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
          wait().then(() =>
            coll.deleteOne({_id: insertedIds[3]}).then(() => wait().then(() => coll.drop()))
          );
        });
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

    it("should order descending by number property", done => {
      const coll = database.collection("test16");
      coll.insertMany([{test: 1}, {test: 3}, {test: 4}]).then(({insertedIds}) => {
        realtime
          .find("test16", {sort: {test: 1}})
          .pipe(bufferCount(6))
          .subscribe(chunks => {
            expect(chunks).toEqual([
              {kind: ChunkKind.Initial, document: {_id: insertedIds[0], test: 1}},
              {kind: ChunkKind.Initial, document: {_id: insertedIds[1], test: 3}},
              {kind: ChunkKind.Initial, document: {_id: insertedIds[2], test: 4}},
              {kind: ChunkKind.EndOfInitial},
              {kind: ChunkKind.Update, document: {_id: insertedIds[2], test: 2}},
              {
                kind: ChunkKind.Order,
                sequence: [
                  {
                    kind: SequenceKind.Substitute,
                    item: insertedIds[2].toHexString(),
                    with: insertedIds[1].toHexString(),
                    at: 2
                  },
                  {
                    kind: SequenceKind.Substitute,
                    item: insertedIds[1].toHexString(),
                    with: insertedIds[2].toHexString(),
                    at: 1
                  }
                ]
              }
            ]);
            done();
          });
        wait().then(() => coll.updateOne({_id: insertedIds[2]}, {$set: {test: 2}}));
      });
    });

    it("should order descending by _id property and limit to 2", done => {
      const coll = database.collection("test17");
      coll.insertOne({test: 1}).then(({insertedId}) => {
        let laterInsertedId: ObjectId;
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
                    item: laterInsertedId.toHexString(),
                    with: insertedId.toHexString(),
                    at: 1
                  },
                  {
                    kind: SequenceKind.Substitute,
                    item: insertedId.toHexString(),
                    with: laterInsertedId.toHexString(),
                    at: 0
                  }
                ]
              }
            ]);
            done();
          });
        wait().then(() =>
          coll
            .insertOne({test: 2})
            .then(({insertedId: _insertedId}) => (laterInsertedId = _insertedId))
        );
      });
    });

    it("should order descending by _id property and limit to one", done => {
      const coll = database.collection("test18");
      coll.insertOne({test: 1}).then(({insertedId}) => {
        let laterInsertedId;
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
                    item: insertedId.toHexString()
                  }
                ]
              }
            ]);
            done();
          });
        wait(LATENCY).then(() =>
          coll
            .insertOne({test: 2})
            .then(({insertedId: _insertedId}) => (laterInsertedId = _insertedId))
        );
      });
    });

    it("should order descending by _id property and limit to one and expunge", done => {
      const coll = database.collection("test19");
      coll.insertOne({test: 1}).then(({insertedId}) => {
        let laterInsertedIds;
        let laterInsertedIds2;
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
                  {kind: SequenceKind.Insert, item: insertedId.toHexString(), at: 3},
                  {kind: SequenceKind.Delete, item: insertedId.toHexString(), at: 0}
                ]
              },
              {kind: ChunkKind.Insert, document: {_id: laterInsertedIds2[2], test: 7}},
              {kind: ChunkKind.Insert, document: {_id: laterInsertedIds2[1], test: 6}},
              {kind: ChunkKind.Insert, document: {_id: laterInsertedIds2[0], test: 5}},
              {
                kind: ChunkKind.Order,
                sequence: [
                  {kind: SequenceKind.Insert, item: laterInsertedIds[2].toHexString(), at: 3},
                  {kind: SequenceKind.Delete, item: insertedId.toHexString(), at: 3},
                  {kind: SequenceKind.Delete, item: laterInsertedIds[0].toHexString(), at: 2},
                  {kind: SequenceKind.Delete, item: laterInsertedIds[1].toHexString(), at: 1},
                  {kind: SequenceKind.Delete, item: laterInsertedIds[2].toHexString(), at: 0}
                ]
              }
            ]);
            done();
          });
        wait(LATENCY).then(() =>
          coll.insertMany([{test: 2}, {test: 3}, {test: 4}]).then(({insertedIds: _insertedId}) => {
            laterInsertedIds = _insertedId;
            wait(LATENCY).then(() =>
              coll
                .insertMany([{test: 5}, {test: 6}, {test: 7}])
                .then(({insertedIds: _insertedIds2}) => (laterInsertedIds2 = _insertedIds2))
            );
          })
        );
      });
    });

    it("should order descending by _id property and limit to one and expunge", done => {
      const coll = database.collection("test20");
      coll.insertMany([{test: 1}, {test: 2}]).then(({insertedIds: initiallyInsertedIds}) => {
        let laterInsertedIds;
        realtime
          .find("test20", {sort: {_id: -1}, limit: 2})
          .pipe(bufferCount(6))
          .subscribe(chunks => {
            expect(chunks).toEqual([
              {kind: ChunkKind.Initial, document: {_id: initiallyInsertedIds[1], test: 2}},
              {kind: ChunkKind.Initial, document: {_id: initiallyInsertedIds[0], test: 1}},
              {kind: ChunkKind.EndOfInitial},
              {kind: ChunkKind.Insert, document: {_id: laterInsertedIds[1], test: 4}},
              {kind: ChunkKind.Insert, document: {_id: laterInsertedIds[0], test: 3}},
              {
                kind: ChunkKind.Order,
                sequence: [
                  {kind: SequenceKind.Delete, item: initiallyInsertedIds[0].toHexString(), at: 1},
                  {kind: SequenceKind.Delete, item: initiallyInsertedIds[1].toHexString(), at: 0}
                ]
              }
            ]);
            done();
          });
        wait(LATENCY * 2).then(() =>
          coll
            .insertMany([{test: 3}, {test: 4}])
            .then(({insertedIds: _insertedIds}) => (laterInsertedIds = _insertedIds))
        );
      });
    });
  });
});
