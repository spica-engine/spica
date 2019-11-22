import * as grpc from "grpc";
import {Event, EventQueueService} from "@spica-server/function/queue/proto";
import {Queue} from "./queue";

export class EventQueue {
  private server = new grpc.Server();
  private queue = new Set<Event.AsObject>();

  listen() {
    this.server.bind("0.0.0.0:5678", grpc.ServerCredentials.createInsecure());
    this.server.addService(EventQueueService, {
      pop: this.pop.bind(this)
    });
    this.server.start();
  }

  kill() {
    this.server.forceShutdown();
  }

  enqueue(event: Event.AsObject) {
    this.queue.add(event);
  }

  pop(_: grpc.ServerUnaryCall<Event>, callback: grpc.sendUnaryData<Event>) {
    if (this.queue.size < 1) {
      callback(new Error("Queue is empty."), undefined);
    } else {
      const fi = this.queue.values().next().value as Event.AsObject;
      this.queue.delete(fi);
      const event = new Event();
      event.setId(fi.id);
      event.setType(fi.type);
      callback(undefined, event);
    }
  }

  addQueue<T>(queue: Queue<T>) {
    this.server.addService(queue.TYPE, queue.create());
  }
}

export const EventType = {
  HTTP: Event.Type.HTTP,
  SCHEDULE: Event.Type.SCHEDULE,
  DATABASE: Event.Type.DATABASE,
  FIREHOSE: Event.Type.FIREHOSE
};
