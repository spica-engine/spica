import {ChangeQueue as BucketChangeQueue} from "@spica-server/bucket-hooks-proto-node";
import {
  DatabaseQueue,
  FirehoseQueue,
  GrpcQueue,
  HttpQueue,
  RabbitMQQueue
} from "@spica-server/function-queue-node";

// Each queue wraps a @grpc/grpc-js client, and grpc-js keeps a client it created reachable
// until close() (idle timer, shared subchannel listener, channelz registry). Creating one per
// event leaked a channel per invocation, so a worker reuses one client per queue instead.
function lazy<T>(create: () => T): () => T {
  let instance: T | undefined;
  return () => (instance ??= create());
}

export const httpQueue = lazy(() => new HttpQueue());
export const databaseQueue = lazy(() => new DatabaseQueue());
export const firehoseQueue = lazy(() => new FirehoseQueue());
export const bucketChangeQueue = lazy(() => new BucketChangeQueue());
export const rabbitmqQueue = lazy(() => new RabbitMQQueue());
export const grpcQueue = lazy(() => new GrpcQueue());
