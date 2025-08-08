import {event} from "../../queue/proto";
import {Description} from "../../../../../../libs/interface/function/enqueuer";

export abstract class Enqueuer<OptionsT> {
  type: event.Type;
  abstract description: Description;
  abstract subscribe(target: event.Target, options: OptionsT): void;
  abstract unsubscribe(target: event.Target): void;
  abstract onEventsAreDrained(events: event.Event[]): Promise<any>;
}
