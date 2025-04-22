import {EventQueue} from "@spica-server/function/queue";
import {event} from "@spica-server/function/queue/proto";
import {Subject} from "rxjs";
import {debounceTime, take} from "rxjs/operators";
import {Enqueuer} from "./enqueuer";
import {Description, EventOptions} from "@spica-server/interface/function/enqueuer";

export class SystemEnqueuer implements Enqueuer<EventOptions> {
  type = event.Type.DATABASE;

  private readyTargets = new Set<event.Target>();
  private subscriptionSubject = new Subject();

  description: Description = {
    icon: "build",
    name: "system",
    title: "System",
    description: "Designed to interact with the system events."
  };

  constructor(private queue: EventQueue) {
    this.subscriptionSubject
      .pipe(debounceTime(1000), take(1))
      .subscribe(() => this.invokeReadyEventTargets());
  }

  onEventsAreDrained(events: event.Event[]): Promise<any> {
    return Promise.resolve();
  }

  private invokeReadyEventTargets() {
    for (const target of this.readyTargets) {
      this.queue.enqueue(
        new event.Event({
          type: event.Type.SYSTEM,
          target
        })
      );
    }
  }

  subscribe(target: event.Target, options: EventOptions): void {
    if (options.name == "READY") {
      this.readyTargets.add(target);
      this.subscriptionSubject.next(target);
    }
  }

  unsubscribe(target: event.Target): void {
    for (const eventTarget of this.readyTargets) {
      if (
        (!target.handler && eventTarget.cwd == target.cwd) ||
        (target.handler && eventTarget.cwd == target.cwd && eventTarget.handler == target.handler)
      ) {
        this.readyTargets.delete(eventTarget);
      }
    }
  }
}
