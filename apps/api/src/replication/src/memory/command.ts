import {Injectable, Inject} from "@nestjs/common";
import {CommandService} from "../database/command";
import {
  CommandMessage,
  COMMAND_MEMORY_OPTIONS,
  MemoryOptions
} from "../../../../../../libs/interface/replication";
import {MongoMemory} from "./mongo";

@Injectable()
export class CommandMemory extends MongoMemory<CommandMessage> {
  constructor(cmdService: CommandService, @Inject(COMMAND_MEMORY_OPTIONS) options: MemoryOptions) {
    super(cmdService, options);
  }
}
