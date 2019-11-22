import {EventQueueClient, Event} from "@spica-server/function/queue/proto";
import * as grpc from "grpc";

export class EventQueue {
  private client: EventQueueClient;

  constructor() {
    this.client = new EventQueueClient("0.0.0.0:5678", grpc.credentials.createInsecure());
  }

  pop(): Promise<Event.AsObject> {
    return new Promise((resolve, reject) => {
      this.client.pop(new Event.Pop(), (error, event) => {
        if (error) {
          reject(error);
        } else {
          resolve(event.toObject());
        }
      });
    });
  }
}
