import {Description, Enqueuer} from "@spica-server/function/enqueuer";
import {EventQueue} from "@spica-server/function/queue";
import {Event} from "@spica-server/function/queue/proto";
import {hooks} from "@spica-server/bucket/hooks/proto";
import {ReviewDispatcher, reviewKey} from "./dispatcher";
import {ChangeAndReviewQueue} from "./queue";
import {ChangeEmitter, changeKey} from "./emitter";

export interface ReviewOrChangeOptions {
  bucket: string;
  phase: "BEFORE" | "AFTER";
  type: string;
}

export function mapHeaders(rawHeaders: Object) {
  const headers: hooks.Review.Header[] = [];
  for (const header in rawHeaders) {
    headers.push(
      new hooks.Review.Header({
        key: header,
        value: rawHeaders[header]
      })
    );
  }
  return headers;
}

export function getReviewType(type: string) {
  switch (type) {
    case "insert":
      return hooks.Review.Type.INSERT;
    case "update":
      return hooks.Review.Type.UPDATE;
    case "delete":
      return hooks.Review.Type.DELETE;
    case "index":
      return hooks.Review.Type.INDEX;
    case "get":
      return hooks.Review.Type.GET;
    case "stream":
      return hooks.Review.Type.STREAM;
    default:
      throw new Error(`Invalid type received. ${type}`);
  }
}

function getChangeType(type: string): hooks.Change.Kind {
  switch (type) {
    case "insert":
      return hooks.Change.Kind.INSERT;
    case "delete":
      return hooks.Change.Kind.DELETE;
    case "update":
      return hooks.Change.Kind.UPDATE;
    default:
      throw new Error(`Invalid type received. ${type}`);
  }
}

export class ChangeAndReviewEnqueuer extends Enqueuer<ReviewOrChangeOptions> {
  description: Description = {
    icon: "view_agenda",
    name: "bucket",
    title: "Bucket",
    description: "Review and capture the things that happen in data endpoints."
  };

  private reviewTargets = new Map<
    Event.Target,
    {options: ReviewOrChangeOptions; handler: (callback, headers, document) => void}
  >();

  private changeTargets = new Map<
    Event.Target,
    {options: ReviewOrChangeOptions; handler: (type, documentKey, previous, current) => void}
  >();

  constructor(
    private queue: EventQueue,
    private reviewAndChangeQueue: ChangeAndReviewQueue,
    private reviewDispatcher: ReviewDispatcher,
    private changeEmitter: ChangeEmitter
  ) {
    super();
  }

  subscribe(target: Event.Target, options: ReviewOrChangeOptions) {
    if (options.phase == "BEFORE") {
      const handler = (callback, headers, document) => {
        const event = new Event.Event({
          target,
          type: Event.Type.BUCKET
        });
        this.queue.enqueue(event);
        this.reviewAndChangeQueue.enqueue(
          event.id,
          new hooks.ChangeOrReview({
            review: new hooks.Review({
              headers: mapHeaders(headers),
              bucket: options.bucket,
              type: getReviewType(options.type.toLowerCase()),
              documentKey: document
            })
          }),
          callback
        );
      };
      this.reviewTargets.set(target, {options, handler: handler});
      this.reviewDispatcher.on(reviewKey(options.bucket, options.type), handler);
    } else {
      const enqueuer = (type, documentKey, previous, current) => {
        const event = new Event.Event({
          target,
          type: Event.Type.BUCKET
        });
        this.queue.enqueue(event);
        this.reviewAndChangeQueue.enqueue(
          event.id,
          new hooks.ChangeOrReview({
            change: new hooks.Change({
              bucket: options.bucket,
              kind: getChangeType(type),
              documentKey: documentKey,
              previous: JSON.stringify(previous),
              current: JSON.stringify(current)
            })
          })
        );
      };
      this.changeTargets.set(target, {options, handler: enqueuer});
      this.changeEmitter.on(changeKey(options.bucket, options.type), enqueuer);
    }
  }

  unsubscribe(target: Event.Target) {
    for (const [actionTarget, {handler, options}] of this.reviewTargets) {
      if (
        (!target.handler && actionTarget.cwd == target.cwd) ||
        (target.handler && actionTarget.cwd == target.cwd && actionTarget.handler == target.handler)
      ) {
        this.reviewTargets.delete(actionTarget);
        this.reviewDispatcher.off(reviewKey(options.bucket, options.type), handler);
      }
    }
    for (const [actionTarget, {handler, options}] of this.changeTargets) {
      if (
        (!target.handler && actionTarget.cwd == target.cwd) ||
        (target.handler && actionTarget.cwd == target.cwd && actionTarget.handler == target.handler)
      ) {
        this.changeTargets.delete(actionTarget);
        this.changeEmitter.off(changeKey(options.bucket, options.type), handler);
      }
    }
  }
}
