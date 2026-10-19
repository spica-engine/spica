import {Injectable, Optional} from "@nestjs/common";
import {
  ClassCommander,
  CollectionChangeDispatcher,
  CollectionChangeEvent
} from "@spica-server/replication";

export interface SecretChangeEvent extends CollectionChangeEvent {
  keys: string[];
}

@Injectable()
export class SecretChangeDispatcher extends CollectionChangeDispatcher<SecretChangeEvent> {
  constructor(@Optional() commander?: ClassCommander) {
    super(commander);
  }
}
