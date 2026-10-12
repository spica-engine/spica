import {RabbitMQ} from "@spica-server/function-queue-proto";
import grpc from "@grpc/grpc-js";
import {Queue} from "../queue.js";
import {RabbitMQSettlement} from "./settlement.js";
import {RABBITMQ_SETTLEMENTS} from "./settlements.js";

const DEFAULT_MODE = "queue";

export class RabbitMQQueue extends Queue<typeof RabbitMQ.UnimplementedQueueService.definition> {
  readonly TYPE = RabbitMQ.UnimplementedQueueService.definition;

  private queue = new Map<string, RabbitMQ.Message>();

  private settlements: Map<string, RabbitMQSettlement>;

  constructor(settlements: RabbitMQSettlement[] = RABBITMQ_SETTLEMENTS()) {
    super();
    this.settlements = new Map(settlements.map(settlement => [settlement.mode, settlement]));
  }

  get size(): number {
    return this.queue.size;
  }

  get pendingDeliveries(): number {
    let pending = 0;
    for (const settlement of this.settlements.values()) {
      pending += settlement.pending;
    }
    return pending;
  }

  get(id: string) {
    return this.queue.get(id);
  }

  enqueue(id: string, message: RabbitMQ.Message, delivery?: unknown) {
    this.queue.set(id, message);
    if (delivery) {
      this.settlementFor(message.mode || DEFAULT_MODE).track(id, delivery);
    }
  }

  dequeue(id: string) {
    this.queue.delete(id);
    for (const settlement of this.settlements.values()) {
      settlement.forget(id);
    }
  }

  purge(owner: unknown) {
    for (const settlement of this.settlements.values()) {
      settlement.purge(owner);
    }
  }

  pop(
    call: grpc.ServerUnaryCall<RabbitMQ.Message.Pop, RabbitMQ.Message>,
    callback: grpc.sendUnaryData<RabbitMQ.Message>
  ) {
    if (!this.queue.has(call.request.id)) {
      callback(new Error(`Queue has no item with id ${call.request.id}`), undefined);
    } else {
      callback(undefined, this.queue.get(call.request.id));
      this.queue.delete(call.request.id);
    }
  }

  create() {
    const handlers: any = {pop: this.pop.bind(this)};
    for (const settlement of this.settlements.values()) {
      Object.assign(handlers, settlement.handlers());
    }
    return handlers;
  }

  private settlementFor(mode: string) {
    const settlement = this.settlements.get(mode);
    if (!settlement) {
      throw new Error(`No settlement is registered for the rabbitmq mode "${mode}".`);
    }
    return settlement;
  }
}
