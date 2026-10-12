import {EventQueue, RabbitMQOptions, RabbitMQQueue} from "@spica-server/function-queue";
import {Enqueuer} from "../enqueuer.js";
import {Description} from "@spica-server/interface-function-enqueuer";
import {event, RabbitMQ} from "@spica-server/function-queue-proto";
import uniqid from "uniqid";
import {Logger} from "@nestjs/common";
import {RabbitMQStrategy, Session, Subscription} from "./strategy.js";
import {RABBITMQ_STRATEGIES} from "./strategies.js";

export interface RabbitMQRetryPolicy {
  initialDelayMs: number;
  maxDelayMs: number;
  stableAfterMs: number;
}

const DEFAULT_MODE = "queue";

export class RabbitMQEnqueuer extends Enqueuer<RabbitMQOptions> {
  type = event.Type.RABBITMQ;
  private readonly logger = new Logger(RabbitMQEnqueuer.name);

  description: Description = {
    title: "RabbitMQ",
    name: "rabbitmq",
    icon: "markunread_mailbox",
    description:
      "Designed for reliable background job processing and asynchronous event consumption."
  };

  private subscriptions: Subscription[] = [];
  private strategies: Map<string, RabbitMQStrategy>;

  constructor(
    private queue: EventQueue,
    private rabbitmqQueue: RabbitMQQueue,
    private retryPolicy: RabbitMQRetryPolicy = {
      initialDelayMs: 1_000,
      maxDelayMs: 60_000,
      stableAfterMs: 30_000
    },
    strategies: RabbitMQStrategy[] = RABBITMQ_STRATEGIES(rabbitmqQueue)
  ) {
    super();
    this.strategies = new Map(strategies.map(strategy => [strategy.mode, strategy]));
  }

  subscribe(target: event.Target, options: RabbitMQOptions): void {
    const subscription: Subscription = {target, options, cancelled: false, run: 0, attempt: 0};
    const mode = options.mode ?? DEFAULT_MODE;

    if (!this.strategies.has(mode)) {
      const message = `Unknown rabbitmq mode "${mode}".`;
      this.logger.error(`${message} (${this.describe(subscription)})`);
      this.onErrorHandler(target, message);
      return;
    }

    this.subscriptions.push(subscription);
    this.connect(subscription).catch(error =>
      this.logger.error(
        `Unexpected error while connecting ${this.describe(subscription)}: ${error.message}`
      )
    );
  }

  unsubscribe(target: event.Target): void {
    const matching = this.subscriptions.filter(subscription => {
      const isCwdEqual = subscription.target.cwd == target.cwd;
      const isHandlerEqual = subscription.target.handler == target.handler;
      return target.handler ? isHandlerEqual && isCwdEqual : isCwdEqual;
    });

    matching.forEach(subscription => this.stop(subscription));
  }

  onEventsAreDrained(events: event.Event[]): Promise<any> {
    [...this.subscriptions].forEach(subscription => this.stop(subscription));
    return Promise.resolve();
  }

  private strategyOf(subscription: Subscription) {
    return this.strategies.get(subscription.options.mode ?? DEFAULT_MODE);
  }

  private stop(subscription: Subscription) {
    subscription.cancelled = true;
    clearTimeout(subscription.retryTimer);
    this.release(subscription);
    this.subscriptions.splice(this.subscriptions.indexOf(subscription), 1);
  }

  private async connect(subscription: Subscription) {
    const run = ++subscription.run;
    const session = this.sessionOf(subscription, run);

    try {
      await this.strategyOf(subscription).open(subscription, session);

      if (session.isStale()) {
        return;
      }
      this.armStabilization(subscription, run);
    } catch (error) {
      this.fail(subscription, run, error.message);
    }
  }

  private sessionOf(subscription: Subscription, run: number): Session {
    return {
      isStale: () => subscription.cancelled || subscription.run !== run,
      fail: reason => this.fail(subscription, run, reason),
      deliver: (message, delivery) => this.deliver(subscription, run, message, delivery)
    };
  }

  private armStabilization(subscription: Subscription, run: number) {
    clearTimeout(subscription.stabilizeTimer);
    subscription.stabilizeTimer = setTimeout(() => {
      if (subscription.cancelled || subscription.run !== run) {
        return;
      }
      subscription.attempt = 0;
    }, this.retryPolicy.stableAfterMs);
    subscription.stabilizeTimer.unref?.();
  }

  private deliver(
    subscription: Subscription,
    run: number,
    message: RabbitMQ.Message,
    delivery?: unknown
  ) {
    if (subscription.cancelled || subscription.run !== run) {
      return;
    }

    const ev = new event.Event({
      id: uniqid(),
      type: event.Type.RABBITMQ,
      target: subscription.target
    });

    message.mode = this.strategyOf(subscription).mode;

    this.rabbitmqQueue.enqueue(ev.id, message, delivery);
    this.queue.enqueue(ev);
  }

  private onErrorHandler(target: event.Target, errorMessage: string) {
    const ev = new event.Event({
      id: uniqid(),
      type: event.Type.RABBITMQ,
      target
    });

    const message = new RabbitMQ.Message({
      errorMessage: Buffer.from(errorMessage)
    });

    this.rabbitmqQueue.enqueue(ev.id, message);
    this.queue.enqueue(ev);
  }

  private fail(subscription: Subscription, run: number, message: string) {
    if (subscription.cancelled || subscription.run !== run) {
      return;
    }

    subscription.run++;
    this.release(subscription);

    this.onErrorHandler(subscription.target, message);

    const {initialDelayMs, maxDelayMs} = this.retryPolicy;
    const delay = Math.min(initialDelayMs * 2 ** subscription.attempt, maxDelayMs);
    subscription.attempt++;

    subscription.retryTimer = setTimeout(() => this.connect(subscription), delay);
    subscription.retryTimer.unref?.();
  }

  private release(subscription: Subscription) {
    clearTimeout(subscription.stabilizeTimer);
    this.strategyOf(subscription).release(subscription);
  }

  private describe(subscription: Subscription) {
    return `${subscription.target.cwd}:${subscription.target.handler}`;
  }
}
