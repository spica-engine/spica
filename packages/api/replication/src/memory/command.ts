import {Injectable, Inject} from "@nestjs/common";
import {
  COMMAND_COLLECTION,
  COMMAND_REPOSITORY,
  CommandMessage,
  CommandRepository,
  COMMAND_MEMORY_OPTIONS,
  MemoryOptions
} from "@spica-server/interface-replication";
import {CHANGE_FEED, ChangeFeed} from "@spica-server/interface-data";
import {FeedMemory} from "./feed.js";

@Injectable()
export class CommandMemory extends FeedMemory<CommandMessage> {
  constructor(
    @Inject(CHANGE_FEED) feed: ChangeFeed,
    @Inject(COMMAND_REPOSITORY) commands: CommandRepository,
    @Inject(COMMAND_MEMORY_OPTIONS) options: MemoryOptions
  ) {
    super(feed, COMMAND_COLLECTION, commands, options);
  }
}
