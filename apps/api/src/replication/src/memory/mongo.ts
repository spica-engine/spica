import {BaseCollection} from "@spica-server/database";
import {ChangeStream} from "mongodb";
import {PartialObserver} from "rxjs";
import {MemoryOptions, IPubSub} from "@spica-server/replication";

export class MongoMemory<T> implements IPubSub<T> {
  private _changeStream: ChangeStream;
  public get changeStream(): ChangeStream {
    if (!this._changeStream) {
      this._changeStream = this.service._coll.watch([
        {
          $match: {
            operationType: {$in: this.options.changeType}
          }
        }
      ]);
    }

    return this._changeStream;
  }

  constructor(private service: BaseCollection<any>, private options: MemoryOptions) {}

  publish(document: T) {
    this.service._coll.insertOne(document).then(r => r.ops[0]);
  }

  subscribe(observer: PartialObserver<T>) {
    const stream = this.changeStream;

    const callback = change => observer.next(change.fullDocument);
    stream.on("change", callback);

    return {
      unsubscribe: () => {
        stream.removeListener("change", callback);
      }
    };
  }
}
