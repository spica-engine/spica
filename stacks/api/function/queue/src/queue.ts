import * as grpc from "grpc";

export abstract class Queue<T> {
  abstract TYPE: grpc.ServiceDefinition<T>;
  abstract create(): T;
}
