import {Injectable} from "@nestjs/common";
import {ChangeStreamOptions, DatabaseService} from "@spica-server/database";
import {ChangeEvent, ChangeFeed, ChangeFeedOptions} from "@spica-server/interface-data";
import {Observable} from "rxjs";

@Injectable()
export class MongoChangeFeed implements ChangeFeed {
  constructor(private readonly db: DatabaseService) {}

  watch<T = any>(collection: string, options: ChangeFeedOptions = {}): Observable<ChangeEvent<T>> {
    const {operations, document, beforeChange} = options;
    const pipeline = operations
      ? [{$match: {operationType: operations.length == 1 ? operations[0] : {$in: operations}}}]
      : [];
    const streamOptions: ChangeStreamOptions = {maxAwaitTimeMS: this.db.changeStreamAwaitTimeMS};
    if (document == "current") {
      streamOptions.fullDocument = "updateLookup";
    }
    if (beforeChange == "whenAvailable") {
      streamOptions.fullDocumentBeforeChange = "whenAvailable";
    }

    return new Observable<ChangeEvent<T>>(observer => {
      const stream = this.db.collection(collection).watch(pipeline, streamOptions);
      stream.on("change", change => observer.next(toChangeEvent<T>(change, collection)));
      stream.on("error", error => observer.error(error));

      return () => {
        if (!stream.closed) {
          stream.close();
        }
      };
    });
  }
}

function toChangeEvent<T>(change: any, collection: string): ChangeEvent<T> {
  const event: ChangeEvent<T> = {
    id: change._id._data,
    operation: change.operationType,
    collection: change.ns?.coll ?? collection,
    key: change.documentKey?._id?.toString(),
    document: change.fullDocument,
    previousDocument: change.fullDocumentBeforeChange
  };
  if (change.updateDescription) {
    event.changes = {
      updated: change.updateDescription.updatedFields ?? {},
      removed: change.updateDescription.removedFields ?? []
    };
  }
  return event;
}
