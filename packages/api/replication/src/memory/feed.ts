import {PartialObserver, Observable, share} from "rxjs";
import {MemoryOptions, IPubSub} from "@spica-server/interface-replication";
import {ChangeEvent, ChangeFeed} from "@spica-server/interface-data";

export class FeedMemory<T> implements IPubSub<T> {
  private changeStream$: Observable<ChangeEvent<T>>;

  constructor(
    feed: ChangeFeed,
    collection: string,
    private store: {insert(document: T): Promise<unknown>},
    private options: MemoryOptions
  ) {
    this.changeStream$ = feed
      .watch<T>(collection, {operations: this.options.changeType})
      .pipe(share());
  }

  publish(document: T) {
    this.store.insert({...document, created_at: new Date()});
  }

  subscribe(observer: PartialObserver<T>) {
    const sub = this.changeStream$.subscribe(change => observer.next(change.fullDocument));
    return {unsubscribe: () => sub.unsubscribe()};
  }
}
