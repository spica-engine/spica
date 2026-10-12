import {RabbitMQ} from "@spica-server/function-queue-proto";

export interface RabbitMQSettlement {
  readonly mode: string;
  readonly pending: number;
  track(id: string, delivery: unknown): void;
  forget(id: string): void;
  purge(owner: unknown): void;
  handlers(): Partial<RabbitMQ.UnimplementedQueueService>;
}
