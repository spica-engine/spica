import * as grpc from "@grpc/grpc-js";

export abstract class Queue<T> {
  abstract TYPE: grpc.ServiceDefinition<T>;
  abstract create(): T;
}
