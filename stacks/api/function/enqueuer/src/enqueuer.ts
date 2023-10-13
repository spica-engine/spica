import {event} from "@spica-server/function/queue/proto";

export interface Description {
  name: string;
  icon: string;
  title: string;
  description?: string;
}

export abstract class Enqueuer<OptionsT> {
  type: event.Type;
  abstract description: Description;
  abstract subscribe(target: event.Target, options: OptionsT): void;
  abstract unsubscribe(target: event.Target): void;
  abstract onEventsAreDrained(events: event.Event[]): Promise<any>;
}
