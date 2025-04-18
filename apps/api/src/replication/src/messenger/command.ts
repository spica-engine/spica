import {Injectable, Inject} from "@nestjs/common";
import {PartialObserver} from "rxjs";
import {
  CommandMessage,
  CommandMessageFilter,
  REPLICA_ID
} from "@spica-server/interface/replication";
import {CommandMemory} from "../memory";
import {Messenger} from "./messenger";

@Injectable()
export class CommandMessenger extends Messenger<CommandMessage> {
  private eliminateOwnCommands: CommandMessageFilter = msg => msg.source.id != this.replicaId;

  readonly replicaId: string;

  constructor(memory: CommandMemory, @Inject(REPLICA_ID) replicaId: string) {
    super(memory);

    this.replicaId = replicaId;

    this.filters.push(this.eliminateOwnCommands);
  }

  subscribe(observer: PartialObserver<CommandMessage>) {
    return super.subscribe(observer);
  }

  publish(msg: CommandMessage) {
    msg.source.id = this.replicaId;
    return super.publish(msg);
  }
}
