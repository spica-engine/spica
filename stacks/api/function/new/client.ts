import {credentials} from "grpc";
import {EventQueueClient} from "./request_grpc_pb";
import {Event} from "./request_pb";

const client = new EventQueueClient("localhost:4600", credentials.createInsecure());

client.pop(new Event.Pop(), (error, event) => {
  console.log(error, event.toObject());
});
