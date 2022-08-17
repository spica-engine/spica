import {Injectable, Scope} from "@nestjs/common";
import {CommandMessenger} from "./messenger";
import {
  CommandMessage,
  CommandMessageFilter,
  CommandSource,
  CommandTarget,
  ICommander,
  Command
} from "./interface";

abstract class Commander implements ICommander {
  protected filters: CommandMessageFilter[] = [];

  public readonly replicaId: string;
  constructor(private cmdMessenger: CommandMessenger) {
    this.replicaId = this.cmdMessenger.replicaId;
  }

  register(ctx: Object, ...args): void {
    const onMessageReceived = (msg: CommandMessage) => {
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
        `Replica ${this.cmdMessenger.replicaId} has no method named ${cmd.handler} on ${cmd.class}`
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

@Injectable({scope: Scope.TRANSIENT})
export class ClassCommander extends Commander {
  constructor(cmdMessenger: CommandMessenger) {
    super(cmdMessenger);
  }

  register(ctx: Object, handlers: string[]) {
    // basically it refactors original handler as it will emit the command to others
    // but others will not emit the same otherwise there will be infinite loop
    for (const handler of handlers) {
      const fn = ctx[handler];
      ctx[`__${handler}__`] = fn;

      ctx[handler] = (...args) => {
        this.emit({
          command: {
            class: ctx.constructor.name,
            handler: `__${handler}__`,
            args
          }
        });
        return ctx[`__${handler}__`];
      };
    }

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

  updateFilters(filters: CommandMessageFilter[]) {
    const commander = new ClassCommander(this["cmdMessenger"]);
    commander.register = ctx => {
      commander.filters.push(...filters);
      super.register(ctx);
    };
    return commander;
  }
}
