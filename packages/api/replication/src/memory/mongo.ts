import {BaseCollection} from "@spica-server/database";
import {PartialObserver, Observable, share} from "rxjs";
import {MemoryOptions, IPubSub} from "@spica-server/interface-replication";

export class MongoMemory<T> implements IPubSub<T> {
  private changeStream$: Observable<any>;

  constructor(
    private service: BaseCollection<any>,
    private options: MemoryOptions
  ) {
    this.changeStream$ = this.service
      .watch([{$match: {operationType: {$in: this.options.changeType}}}])
      .pipe(share());
  }

  publish(document: T) {
    this.service._coll.insertOne(document).then(r => ({...document, _id: r.insertedId}));
  }

  subscribe(observer: PartialObserver<T>) {
    const sub = this.changeStream$.subscribe(change => observer.next(change.fullDocument));
    return {unsubscribe: () => sub.unsubscribe()};
  }
}
