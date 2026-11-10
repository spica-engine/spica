import {ChangeEvent, ChangeFeed} from "@spica-server/interface-data";
import {bufferTime, filter, map, Observable, Subscription} from "rxjs";
import {BatchQueries} from "./batch.js";
import {KeyChange} from "./window.js";

const BATCH_MS = 10;

export interface HubBatch {
  changes: KeyChange[];
  queries: BatchQueries;
}

export interface HubMember {
  deliver(batch: HubBatch): void;
  fail(error: Error): void;
}

export interface HubFeed extends ChangeFeed {
  gaps: Observable<void>;
}

function keyChangeOf(event: ChangeEvent): KeyChange | undefined {
  if (event.key === undefined || event.operation == "drop") {
    return undefined;
  }
  return {
    key: event.key,
    operation: event.operation == "replace" ? "update" : event.operation,
    ...(event.changes && {
      fields: [...Object.keys(event.changes.updated), ...event.changes.removed]
    }),
    ...(event.document && {document: event.document})
  };
}

export class RealtimeHub {
  private readonly members = new Set<HubMember>();
  private subscription?: Subscription;

  constructor(
    private readonly feed: HubFeed,
    private readonly collection: string,
    private readonly onEmpty: () => void,
    private readonly interrupted: () => Error
  ) {}

  join(member: HubMember) {
    this.members.add(member);
    this.subscription ??= this.listen();
    return () => {
      if (this.members.delete(member) && !this.members.size) {
        this.close();
        this.onEmpty();
      }
    };
  }

  private listen() {
    const subscription = new Subscription();
    subscription.add(
      this.feed
        .watch(this.collection, {document: "current"})
        .pipe(
          map(keyChangeOf),
          filter((change): change is KeyChange => change !== undefined),
          bufferTime(BATCH_MS),
          filter(changes => changes.length > 0)
        )
        .subscribe({
          next: changes => {
            const batch = {changes, queries: new BatchQueries()};
            [...this.members].forEach(member => member.deliver(batch));
          },
          error: error => this.failAll(error)
        })
    );
    subscription.add(this.feed.gaps.subscribe(() => this.failAll(this.interrupted())));
    return subscription;
  }

  private failAll(error: Error) {
    const members = [...this.members];
    this.members.clear();
    this.close();
    this.onEmpty();
    members.forEach(member => member.fail(error));
  }

  private close() {
    this.subscription?.unsubscribe();
    this.subscription = undefined;
  }
}
