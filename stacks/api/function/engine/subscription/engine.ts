import {Injectable} from "@nestjs/common";
import {Subscription} from "../interface";
import {LoggerHost} from "../logger";
import {EngineRegistry} from "../registry";
import {InvokerFn, Target} from "../trigger/base";
import {SubscriptionExecutor} from "./executor";

@Injectable()
export class SubscriptionEngine {
  constructor(
    public logger: LoggerHost,
    private executor: SubscriptionExecutor,
    private registry: EngineRegistry
  ) {}

  introduce(subscription: Subscription) {
    const trigger = this.registry.getTrigger(subscription.trigger.type);

    const target: Target = {id: subscription._id, handler: "default"};
    const invoker: InvokerFn = invocation => {
      return this.executor.execute({url: subscription.url}, invocation.parameters);
    };

    trigger.register(invoker, target, subscription.trigger.options);
  }

  refuse(subscription: Subscription) {
    const trigger = this.registry.getTrigger(subscription.trigger.type);
    trigger.register(
      null,
      {id: subscription._id, handler: "default"},
      subscription.trigger.options
    );
  }
}
