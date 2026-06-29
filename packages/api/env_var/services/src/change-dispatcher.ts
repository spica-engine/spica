import {Injectable, Optional} from "@nestjs/common";
import {ClassCommander, CollectionChangeDispatcher} from "@spica-server/replication";

@Injectable()
export class EnvVarChangeDispatcher extends CollectionChangeDispatcher {
  constructor(@Optional() commander?: ClassCommander) {
    super(commander);
  }
}
