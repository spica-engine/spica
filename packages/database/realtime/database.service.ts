import {Injectable} from "@nestjs/common";
import {
  ChangeStream,
  DatabaseService,
  Document,
  FilterQuery,
  MongoClient
} from "@spica-server/database";
import {Observable} from "rxjs";
import {levenshtein} from "./levenshtein";
import {ChunkKind, StreamChunk} from "./stream";

@Injectable()
export class RealtimeDatabaseService {
  constructor(private database: DatabaseService, private mongo: MongoClient) {}

  find<T extends Document = any>(
    name: string,
    options: FindOptions<T> = {}
  ): Observable<StreamChunk<T>> {
    return new Observable<StreamChunk<T>>(observer => {
      let ids = new Set<string>();
      let stream = this.database.collection(name).find(options.filter);

      if (options.skip) {
        stream = stream.skip(options.skip);
      }

      if (options.limit) {
        stream = stream.limit(options.limit);
      }

      if (options.sort) {
        stream = stream.sort(options.sort);
      }

      let timeout: NodeJS.Timeout;

      const sortDataSet = () => {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
          let stream = this.database.collection(name).find(options.filter);
          if (options.skip) {
            stream = stream.skip(options.skip);
          }
          if (options.limit) {
            stream = stream.limit(options.limit);
          }
          if (options.sort) {
            stream = stream.sort(options.sort);
          }

          stream.toArray().then(datas => {
            const syncedIds = datas.map(r => r._id.toString());
            const changes = levenshtein(syncedIds, ids);
            ids = new Set(syncedIds);
            observer.next({kind: ChunkKind.Order, sequence: changes.sequence.reverse()});
          });
        }, 100);
      };

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

      const streams = new Set<ChangeStream>();

      stream.on("data", data => {
        observer.next({kind: ChunkKind.Initial, document: data});
        ids.add(data._id.toString());
      });

      stream.on("end", () => observer.next({kind: ChunkKind.EndOfInitial}));

      const pipeline: object[] = [
        {
          $match: {
            "ns.coll": name
          }
        }
      ];

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
          this.mongo
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
        this.mongo
          .watch(pipeline, {
            fullDocument: "updateLookup"
          })
          .on("change", change => {
            switch (change.operationType) {
              case "insert":
                if (options.limit && ids.size >= options.limit) {
                  return;
                }
                observer.next({kind: ChunkKind.Insert, document: change.fullDocument});
                ids.add(change.documentKey._id.toString());
                if (options.sort) {
                  sortDataSet();
                }
                break;
              case "delete":
                if (ids.has(change.documentKey._id.toString())) {
                  observer.next({kind: ChunkKind.Delete, document: change.documentKey});
                  ids.delete(change.documentKey._id.toString());
                  if (options.limit && ids.size < options.limit) {
                    getMore();
                  }
                  if (options.sort) {
                    sortDataSet();
                  }
                }
                break;
              case "replace":
              case "update":
                if (options.sort) {
                  sortDataSet();
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

      return () => {
        for (const stream of streams) {
          return stream.close();
        }
      };
    });
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
