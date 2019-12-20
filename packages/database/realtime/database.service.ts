import {Injectable} from "@nestjs/common";
import {ChangeStream, DatabaseService, Document, FilterQuery} from "@spica-server/database";
import {Observable, Subject, Subscription} from "rxjs";
import {bufferTime, filter, share} from "rxjs/operators";
import {levenshtein} from "./levenshtein";
import {late} from "./operators";
import {ChunkKind, StreamChunk} from "./stream";

@Injectable()
export class RealtimeDatabaseService {
  _streamCount = 0;

  constructor(private database: DatabaseService) {}

  find<T extends Document = any>(
    name: string,
    options: FindOptions<T> = {}
  ): Observable<StreamChunk<T>> {
    options = options || {};
    let ids = new Set<string>();
    return new Observable<StreamChunk<T>>(observer => {
      options = options || {};

      const streams = new Set<ChangeStream>();
      const pipeline: object[] = [];
      const sort = new Subject<any>();
      let sortSubscription: Subscription;

      if (options.sort) {
        const sortedKeys = Object.keys(options.sort);
        sortSubscription = sort
          .pipe(
            filter(change => {
              if (change.operationType == "update") {
                // TODO: Check this for subdocument updates
                const changedKeys: string[] = (change.updateDescription.removedFields || []).concat(
                  Object.keys(change.updateDescription.updatedFields || {})
                );
                return changedKeys.some(k => sortedKeys.indexOf(k) > -1);
              }
              return true;
            }),
            bufferTime(70),
            filter(changes => changes.length > 0)
          )
          .subscribe(async events => {
            let syncedIds: string[];

            if (
              sortedKeys.length == 1 &&
              sortedKeys[0] == "_id" &&
              events.length > 1 &&
              options.sort._id == -1
            ) {
              events = events.reverse();
            }

            for (const change of events) {
              // TODO: enqueue this events and sent if needed.
              if (change.operationType == "insert") {
                observer.next({kind: ChunkKind.Insert, document: change.fullDocument});
                ids.add(change.documentKey._id.toString());
              }
            }

            // if (
            //   !options.skip &&
            //   options.limit &&
            //   sortedKeys.length == 1 &&
            //   sortedKeys[0] == "_id"
            // ) {
            //   console.log("Falling to local sort.");
            //   syncedIds = Array.from(ids)
            //     .sort((a, b) =>
            //       options.sort._id == 1
            //         ? new ObjectId(a).generationTime - new ObjectId(b).generationTime
            //         : new ObjectId(b).generationTime - new ObjectId(a).generationTime
            //     )
            //     .slice(0, options.limit);
            // } else {
            let stream = this.database.collection(name).find(options.filter);
            if (options.sort) {
              stream = stream.sort(options.sort);
            }

            if (options.skip) {
              stream = stream.skip(options.skip);
            }

            if (options.limit) {
              stream = stream.limit(options.limit);
            }
            syncedIds = await stream.toArray().then(datas => datas.map(r => r._id.toString()));
            // }
            const changeSequence = levenshtein(ids, syncedIds);
            ids = new Set(syncedIds);
            observer.next({kind: ChunkKind.Order, sequence: changeSequence.sequence});
          });
      }

      const getMore = () => {
        this.database
          .collection(name)
          .find(options.filter)
          .skip((options.skip && options.skip + ids.size) || ids.size)
          .limit(options.limit - ids.size)
          .on("data", data => {
            observer.next({kind: ChunkKind.Initial, document: data});
            ids.add(data._id.toString());
          });
      };

      if (options.filter) {
        pipeline.push({
          $match: {
            $or: [
              {
                operationType: "delete"
              },
              Object.keys(options.filter).reduce(
                (accumulator, key) => {
                  accumulator[`fullDocument.${key}`] = options.filter[key];
                  return accumulator;
                },
                {operationType: {$not: {$eq: "delete"}}}
              )
            ]
          }
        });

        streams.add(
          this.database
            .collection(name)
            .watch(
              [
                {
                  $match: Object.keys(options.filter).reduce(
                    (accumulator, key) => {
                      const value = options.filter[key];
                      accumulator[`fullDocument.${key}`] =
                        typeof value == "object" ? {$not: value} : {$ne: value};
                      return accumulator;
                    },
                    {
                      "ns.coll": name,
                      operationType: {$regex: "update|replace"}
                    }
                  )
                }
              ],
              {
                fullDocument: "updateLookup"
              }
            )
            .on("change", change => {
              if (ids.has(change.documentKey._id.toString())) {
                observer.next({
                  kind: ChunkKind.Expunge,
                  document: change.documentKey
                });
                ids.delete(change.documentKey._id.toString());
              }
            })
        );
      }

      streams.add(
        this.database
          .collection(name)
          .watch(pipeline, {
            fullDocument: "updateLookup"
          })
          .on("change", change => {
            switch (change.operationType) {
              case "insert":
                if (options.limit && ids.size >= options.limit && !options.sort) {
                  return;
                }

                if (options.sort) {
                  // If sorting enabled hand over the event to sort
                  sort.next(change);
                } else {
                  observer.next({kind: ChunkKind.Insert, document: change.fullDocument});
                  ids.add(change.documentKey._id.toString());
                }
                break;
              case "delete":
                if (ids.has(change.documentKey._id.toString())) {
                  observer.next({kind: ChunkKind.Delete, document: change.documentKey});
                  ids.delete(change.documentKey._id.toString());
                  // TODO: check this
                  if (options.limit && ids.size < options.limit) {
                    getMore();
                  }
                  // if (options.sort) {
                  //   sort.next(change);
                  // }
                }
                break;
              case "replace":
              case "update":
                if (options.sort) {
                  sort.next(change);
                }
                if (
                  !options.filter &&
                  options.skip &&
                  !ids.has(change.documentKey._id.toString())
                ) {
                  return;
                }

                if (
                  options.limit &&
                  ids.size >= options.limit &&
                  !ids.has(change.documentKey._id.toString())
                ) {
                  return;
                }
                // If the updated or replaced document is deleted immediately
                // after update/replace operation fullDocument will be empty.
                if (change.fullDocument != null) {
                  observer.next({
                    kind: change.operationType == "update" ? ChunkKind.Update : ChunkKind.Replace,
                    document: change.fullDocument
                  });
                }
                break;
              case "drop":
                ids.clear();
                observer.complete();
                break;
            }
          })
      );

      this._streamCount += streams.size;
      return () => {
        this._streamCount -= streams.size;
        if (sortSubscription) {
          sortSubscription.unsubscribe();
        }
        for (const stream of streams) {
          stream.close();
        }
        ids.clear();
      };
    }).pipe(
      share(),
      late((subscriber, connect) => {
        let stream = this.database.collection(name).find(options.filter);
        if (options.sort) {
          stream = stream.sort(options.sort);
        }
        if (options.skip) {
          stream = stream.skip(options.skip);
        }
        if (options.limit) {
          stream = stream.limit(options.limit);
        }
        stream.on("data", data => {
          subscriber.next({kind: ChunkKind.Initial, document: data});
          ids.add(data._id.toString());
        });
        stream.on("end", () => {
          subscriber.next({kind: ChunkKind.EndOfInitial});
          connect();
        });
      })
    );
  }
}

export interface FindOptions<T> {
  filter?: FilterQuery<T>;
  sort?: {
    [index: string]: -1 | 1;
  };
  skip?: number;
  limit?: number;
}
