import {Query} from "mingo";
import {ChunkKind, StreamChunk} from "@spica-server/interface/realtime";
import {ChangeStream, Collection, ObjectId} from "mongodb";
import {asyncScheduler, Observable, Subject, Subscriber, Subscription, TeardownLogic} from "rxjs";
import {filter, bufferTime, switchMap, share} from "rxjs/operators";
import {PassThrough} from "stream";
import {DatabaseChange, FindOptions, OperationType} from "./interface";
import {levenshtein} from "./levenshtein";
import {late} from "./operators";

export class Emitter<T extends {_id: ObjectId}> {
  private sort = new Subject<DatabaseChange<T>>();
  private sortSubscription: Subscription;

  private ids = new Set<string>();

  private observable: Observable<StreamChunk<T>>;
  private observer: Subscriber<StreamChunk<T>>;
  private subscribe: (
    this: Observable<StreamChunk<T>>,
    subscriber: Subscriber<StreamChunk<T>>
  ) => TeardownLogic;

  public collectionName;

  private passThrough = new PassThrough({
    objectMode: true
  });
  constructor(
    private collection: Collection,
    private changeStream: ChangeStream,
    private options: FindOptions<T>
  ) {
    this.collectionName = collection.collectionName;
    this.subscribe = observer => {
      this.observer = observer;
      if (options.sort) {
        this.listenSortChanges();
      }

      this.passThrough.on("data", (change: DatabaseChange<T>) => {
        switch (change.operationType) {
          case OperationType.INSERT:
            if (
              (options.filter && !this.doesMatch(change.fullDocument)) ||
              (options.limit && this.ids.size >= options.limit && !options.sort)
            ) {
              return;
            }

            // If sorting enabled hand over the event to sort
            if (options.sort) {
              return this.sort.next(change);
            }

            this.next({kind: ChunkKind.Insert, document: change.fullDocument});

            break;

          case OperationType.DELETE:
            const documentId = change.documentKey._id.toString();

            if (this.ids.has(documentId)) {
              this.next({kind: ChunkKind.Delete, document: change.documentKey});

              if (options.limit && this.ids.size < options.limit) {
                this.fetchMoreItemToFillTheCursor();
              }
            }

            break;

          case OperationType.REPLACE:
          case OperationType.UPDATE:
            if (!options.filter || this.doesMatch(change.fullDocument)) {
              if (
                !this.isChangeAlreadyPresentInCursor(change) &&
                ((options.limit && this.ids.size >= options.limit) ||
                  (!options.filter && options.skip))
              ) {
                if (options.sort) {
                  this.sort.next(change);
                }
                return;
              }

              // If the updated or replaced document is deleted immediately
              // after update/replace operation fullDocument will be empty.
              if (change.fullDocument != null) {
                this.next({
                  kind:
                    change.operationType == OperationType.UPDATE
                      ? ChunkKind.Update
                      : ChunkKind.Replace,
                  document: change.fullDocument
                });
              }

              if (options.sort) {
                this.sort.next(change);
              }
            } else if (this.isChangeAlreadyPresentInCursor(change)) {
              this.next({
                kind: ChunkKind.Expunge,
                document: change.documentKey
              });
            }

            break;

          case OperationType.DROP:
            this.ids.clear();
            this.observer.complete();

            break;
        }
      });

      this.changeStream.stream().pipe(this.passThrough);

      return this.getTearDownLogic();
    };
  }

  getObservable() {
    if (!this.observable) {
      this.observable = new Observable<StreamChunk<T>>(this.subscribe).pipe(
        share(),
        this.getLateSubscriberOperator()
      );
    }
    return this.observable;
  }

  getLateSubscriberOperator() {
    return late<StreamChunk<T>>((subscriber, connect) => {
      const pipeline = [];

      if (this.options.filter) {
        pipeline.push({
          $match: this.options.filter
        });
      }

      if (this.options.sort) {
        pipeline.push({
          $sort: this.options.sort
        });
      }

      if (this.options.skip) {
        pipeline.push({
          $skip: this.options.skip
        });
      }

      if (this.options.limit) {
        pipeline.push({
          $limit: this.options.limit
        });
      }

      this.collection
        .aggregate(pipeline)
        .toArray()
        .then((documents: T[]) => {
          for (const document of documents) {
            // we can not use this.next since it's designed for notifying all listeners
            subscriber.next({kind: ChunkKind.Initial, document: document});
            this.ids.add(document._id.toString());
          }
        })
        .catch(e => subscriber.error(e))
        .finally(() => {
          // we can not use this.next since it's designed for notifying all listeners
          subscriber.next({kind: ChunkKind.EndOfInitial});
          connect();
        });
    });
  }

  next(message: {kind: ChunkKind; document?: T}) {
    this.observer.next(message);
    const id = message.document._id.toString();

    switch (message.kind) {
      case ChunkKind.Initial:
      case ChunkKind.Insert:
        this.ids.add(id);
        break;
      case ChunkKind.Update:
      case ChunkKind.Replace:
        this.ids.add(id);
        break;
      case ChunkKind.Expunge:
      case ChunkKind.Delete:
        this.ids.delete(id);
        break;
    }
  }

  error(e) {
    this.observer.error(e);
  }

  private getTearDownLogic() {
    return () => {
      if (this.sortSubscription) {
        this.sortSubscription.unsubscribe();
      }

      if (!this.changeStream.closed) {
        this.changeStream.stream().unpipe(this.passThrough);
      }

      this.passThrough.removeAllListeners();
    };
  }

  private listenSortChanges() {
    const sortedKeys = getSortedKeys(this.options.sort);
    this.sortSubscription = this.sort
      .pipe(
        filter(change => this.doesTheChangeAffectTheSortedCursor(sortedKeys, change)),
        // since we can't predict the cascading updates that followed by an order packet
        // we have to buffer all incoming events and process them as soon as the queue lets us
        // also, this could be taken as cursor option to allow the users to change this value as needed.
        // IMPORTANT: if you see a weird behavior such as a order packet precedes an update or insert packet
        // then this bufferTime is the culprit that leads to such behavior. in that case if you increase
        // the buffer time, it is less likely that you'll see such weird behavior.
        // There's no optimal value for this buffering logic since it depends on how frequently the cursor
        // affected by cascading updates or inserts.
        bufferTime(1, asyncScheduler),
        filter(changes => changes.length > 0),
        switchMap(async changes => {
          // This optimizes sorting by sending inserts in reverse order
          // if the cursor sorted by _id property.
          if (
            sortedKeys.length == 1 &&
            sortedKeys[0] == "_id" &&
            changes.length > 1 &&
            this.options.sort._id == -1
          ) {
            changes = changes.reverse();
          }
          for (const change of changes) {
            if (change.operationType == OperationType.INSERT) {
              // CHANGE STREAM DOES THE SAME THING, CHECK WHY
              this.next({kind: ChunkKind.Insert, document: change.fullDocument});
            }
          }

          const syncedIds = await this.fetchSortedIdsOfTheCursor();
          const changeSequence = levenshtein(this.ids, syncedIds);
          if (changeSequence.distance) {
            this.ids = new Set(syncedIds);
            this.observer.next({kind: ChunkKind.Order, sequence: changeSequence.sequence});
          }
        })
      )
      .subscribe();
  }

  private fetchSortedIdsOfTheCursor(): Promise<string[]> {
    const pipeline = [];

    if (this.options.filter) {
      pipeline.push({
        $match: this.options.filter
      });
    }

    if (this.options.sort) {
      pipeline.push({
        $sort: this.options.sort
      });
    }

    if (this.options.skip) {
      pipeline.push({
        $skip: this.options.skip
      });
    }

    if (this.options.limit) {
      pipeline.push({
        $limit: this.options.limit
      });
    }

    pipeline.push({
      $project: {
        _id: 1
      }
    });

    return this.collection
      .aggregate(pipeline)
      .toArray()
      .then(r => r.map(r => r._id.toString()));
  }

  private fetchMoreItemToFillTheCursor() {
    this.collection
      .find<T>(this.options.filter)
      .skip(this.options.skip ? this.options.skip + this.ids.size : this.ids.size)
      .limit(this.options.limit - this.ids.size)
      .next()
      .then(data => this.next({kind: ChunkKind.Initial, document: data}))
      .catch(e => this.error(e));
  }

  private isChangeAlreadyPresentInCursor(change: DatabaseChange<T>) {
    return this.ids.has(change.documentKey._id.toString());
  }

  private doesMatch(document: T): boolean {
    const query = new Query(this.options.filter);
    return query.test(document);
  }

  private doesTheChangeAffectTheSortedCursor(
    sortedKeys: string[],
    change: DatabaseChange<T>
  ): boolean {
    // If the change occurred because of an update operation, we can check if the change affects our cursor by
    // comparing the changed keys and our sorted keys
    if (change.operationType == OperationType.UPDATE) {
      // TODO: Check this for subdocument updates (optimization)
      // This check can be optimized for subdocument updates.
      // Right now it only checks the root properties.
      const changedKeys: string[] = (change.updateDescription.removedFields || []).concat(
        Object.keys(change.updateDescription.updatedFields || {})
      );
      return changedKeys.some(k => sortedKeys.indexOf(k) > -1);
    }

    // if the event is not a update then it might affect the cursor
    return true;
  }
}

// HELPERS
function getSortedKeys(sort: {[k: string]: -1 | 1}) {
  return Object.keys(sort);
}
