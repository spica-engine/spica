import {ICollection} from "@spica-server/database-driver";
import {PartialObserver, Observable, share} from "rxjs";
import {MemoryOptions, IPubSub} from "@spica-server/interface-replication";

export class MongoMemory<T> implements IPubSub<T> {
  private changeStream$: Observable<any>;

  constructor(
    private service: ICollection<any>,
    private options: MemoryOptions
  ) {
    this.changeStream$ = this.service
      .watch([{$match: {operationType: {$in: this.options.changeType}}}])
      .pipe(share());
  }

  publish(document: T) {
    // In the contract `insertOne` returns the inserted document, not Mongo's result object.
    this.service.insertOne(document as any);
  }

  subscribe(observer: PartialObserver<T>) {
    const sub = this.changeStream$.subscribe(change => observer.next(change.fullDocument));
    return {unsubscribe: () => sub.unsubscribe()};
  }
}
