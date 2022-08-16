import {Injectable} from "@nestjs/common";
import {CommandMessenger} from "./messenger";
import {
  CommandMessage,
  CommandMessageFilter,
  CommandSource,
  CommandTarget,
  ICommander,
  Command
} from "./interface";

export class Commander implements ICommander {
  protected filters: CommandMessageFilter[] = [];

  public readonly replicaId: string;
  constructor(private cmdMessenger: CommandMessenger) {
    this.replicaId = this.cmdMessenger.replicaId;
  }

  register(ctx: Object): void {
    const onMessageReceived = async (msg: CommandMessage) => {
      if (!this.filters.every(filter => filter(msg))) {
        return;
      }

      for (const cmd of msg.target.commands) {
        this.executeCommand(ctx, cmd);
      }
    };

    this.cmdMessenger.subscribe({
      next: onMessageReceived
    });
  }

  emit(source: CommandSource, target: CommandTarget) {
    this.cmdMessenger.publish({
      source,
      target
    });
  }

  private executeCommand(ctx: Object, cmd: Command) {
    if (!ctx[cmd.handler]) {
      return console.error(
        `Replica ${this.cmdMessenger.replicaId} has no method named ${cmd.handler}`
      );
    }

    try {
      ctx[cmd.handler](...cmd.args);
    } catch (error) {
      console.error(
        `Replica ${this.cmdMessenger.replicaId} has failed to execute command ${cmd.class}.${cmd.handler}(${cmd.args})`
      );
      return console.error(error);
    }
  }
}

@Injectable()
export class ClassCommander extends Commander {
  constructor(cmdMessenger: CommandMessenger) {
    super(cmdMessenger);
  }

  register(ctx: Object) {
    const filter = (msg: CommandMessage) => this.isSameClass(msg, ctx);

    this.filters.push(filter);

    super.register(ctx);
  }

  emit(source: CommandSource) {
    const target: CommandTarget = {
      commands: [source.command]
    };
    super.emit(source, target);
  }

  private isSameClass(msg: CommandMessage, ctx: Object) {
    return msg.source.command.class == ctx.constructor.name;
  }
}
