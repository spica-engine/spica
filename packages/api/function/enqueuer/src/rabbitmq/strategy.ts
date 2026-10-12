import {event, RabbitMQ} from "@spica-server/function-queue-proto";

export interface Session {
  isStale(): boolean;
  fail(reason: string): void;
  deliver(message: RabbitMQ.Message, delivery?: unknown): void;
}

export type Subscription<Options = any, Resources = {}> = {
  target: event.Target;
  options: Options;
  cancelled: boolean;
  run: number;
  attempt: number;
  retryTimer?: NodeJS.Timeout;
  stabilizeTimer?: NodeJS.Timeout;
} & Partial<Resources>;

export interface RabbitMQStrategy<Options = any, Resources = {}> {
  readonly mode: string;
  open(subscription: Subscription<Options, Resources>, session: Session): Promise<void>;
  release(subscription: Subscription<Options, Resources>): void;
}

export async function attempt<T>(failureMessage: string, action: () => Promise<T>): Promise<T> {
  try {
    return await action();
  } catch (error) {
    throw new Error(`${failureMessage} ${error.message}`);
  }
}
