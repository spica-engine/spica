import {Server, ServerCredentials, ServerUnaryCall} from "grpc";
import {EventQueueService} from "./request_grpc_pb";
import {Event} from "./request_pb";

const server = new Server();

server.addService(EventQueueService, {
  pop: (call: ServerUnaryCall<Event>, callback) => {
 
    console.log(call, call.request.toObject());
    
    const event = new Event();
    event.setId("test");
    event.setType(0);

    callback(null, event);
  }
});
server.bind("localhost:4600", ServerCredentials.createInsecure());
server.start();
