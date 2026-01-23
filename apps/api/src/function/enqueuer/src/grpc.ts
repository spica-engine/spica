import {EventQueue, GrpcQueue} from "@spica-server/function/queue";
import {event, Grpc} from "@spica-server/function/queue/proto";
import {Enqueuer} from "./enqueuer";
import {Description, GrpcOptions} from "@spica-server/interface/function/enqueuer";
import * as grpc from "@grpc/grpc-js";
import uniqid from "uniqid";
import {ClassCommander, JobReducer} from "@spica-server/replication";
import {CommandType} from "@spica-server/interface/replication";

interface GrpcSubscription {
  target: event.Target;
  options: GrpcOptions;
  server?: grpc.Server;
  closed: boolean;
  errorMessage?: string;
}

export class GrpcEnqueuer extends Enqueuer<GrpcOptions> {
  type = event.Type.GRPC;

  description: Description = {
    icon: "settings_ethernet",
    name: "grpc",
    title: "gRPC",
    description: "Designed for high-performance microservices communication"
  };

  private subscriptions: GrpcSubscription[] = [];

  constructor(
    private queue: EventQueue,
    private grpcQueue: GrpcQueue,
    private schedulerUnsubscription: (targetId: string) => void,
    private jobReducer?: JobReducer,
    private commander?: ClassCommander
  ) {
    super();
    if (this.commander) {
      this.commander = this.commander.new();
      this.commander.register(this, [this.shift], CommandType.SHIFT);
    }
  }

  async subscribe(target: event.Target, options: GrpcOptions) {
    const subscription: GrpcSubscription = {target, options, closed: false};
    this.subscriptions.push(subscription);

    try {
      const server = new grpc.Server();
      subscription.server = server;

      const serviceImpl = {};

      serviceImpl[options.method] = (
        call: grpc.ServerUnaryCall<any, any>,
        callback: grpc.sendUnaryData<any>
      ) => {
        this.handleGrpcCall(target, options, call, callback);
      };

      const serviceDefinition = this.createServiceDefinition(options);

      server.addService(serviceDefinition, serviceImpl);

      const port = options.port || 50051;
      const host = options.host || "0.0.0.0";

      await new Promise<void>((resolve, reject) => {
        server.bindAsync(
          `${host}:${port}`,
          grpc.ServerCredentials.createInsecure(),
          (err, port) => {
            if (err) {
              reject(err);
              return;
            }
            server.start();
            console.log(
              `gRPC server for ${options.service}.${options.method} started on port ${port}`
            );
            resolve();
          }
        );
      });
    } catch (err) {
      this.setAsClosed(subscription, target, `Failed to start gRPC server: ${err.message}`);
    }
  }

  private handleGrpcCall(
    target: event.Target,
    options: GrpcOptions,
    call: grpc.ServerUnaryCall<any, any>,
    callback: grpc.sendUnaryData<any>,
    eventId?: string
  ) {
    const ev = new event.Event({
      id: eventId || uniqid(),
      target,
      type: event.Type.GRPC
    });

    this.queue.enqueue(ev);

    const metadata = call.metadata.getMap();
    const metadataArray = Object.keys(metadata).map(key => {
      const header = new Grpc.Header();
      header.key = key;
      header.value = Array.isArray(metadata[key])
        ? metadata[key][0].toString()
        : metadata[key].toString();
      return header;
    });

    const request = new Grpc.Request({
      id: ev.id,
      service: options.service,
      method: options.method,
      payload: Buffer.from(JSON.stringify(call.request)),
      metadata: metadataArray
    });

    const grpcCall = {
      sendMetadata: (metadata: grpc.Metadata) => {
        call.sendMetadata(metadata);
      },
      sendMessage: (message: any) => {
        callback(null, message);
      },
      end: () => {},
      cancelled: false
    };

    call.on("cancelled", () => {
      grpcCall.cancelled = true;
      this.queue.dequeue(ev);
      this.grpcQueue.dequeue(ev.id);
    });

    const enqueue = () => {
      this.queue.enqueue(ev);
      this.grpcQueue.enqueue(ev.id, request, grpcCall);
    };

    const meta = {
      _id: `${target.cwd}-${target.handler}-${options.service}-${options.method}-${Date.now()}`,
      cwd: target.cwd,
      handler: target.handler,
      service: options.service,
      method: options.method,
      event_id: ev.id,
      request: call.request,
      call: grpcCall
    };

    if (this.jobReducer) {
      this.jobReducer.do(meta, enqueue);
    } else {
      enqueue();
    }
  }

  private shift(
    rawRequest,
    rawCall,
    target: {
      id: string;
      cwd: string;
      handler: string;
      context: {
        env: {
          key: string;
          value: string;
        }[];
        timeout: number;
      };
    },
    options: GrpcOptions,
    eventId: string
  ) {
    const newTarget = new event.Target({
      id: target.id,
      cwd: target.cwd,
      handler: target.handler,
      context: new event.SchedulingContext({
        env: Object.keys(target.context.env).reduce((envs, key) => {
          envs.push(
            new event.SchedulingContext.Env({
              key,
              value: target.context.env[key]
            })
          );
          return envs;
        }, []),
        timeout: target.context.timeout
      })
    });

    const callback = (error, response) => {
      if (error) {
        rawCall.sendError(error);
      } else {
        rawCall.sendMessage(response);
      }
    };

    const call = {
      request: rawRequest,
      metadata: new grpc.Metadata(),
      ...rawCall
    };

    return this.handleGrpcCall(newTarget, options, call as any, callback, eventId);
  }

  private setAsClosed(subscription: GrpcSubscription, target: event.Target, errorMessage: string) {
    subscription.closed = true;
    subscription.errorMessage = errorMessage;
    console.error(
      `gRPC subscription for ${target.cwd}:${target.handler} was closed. Reason: ${errorMessage}`
    );
  }

  private createServiceDefinition(options: GrpcOptions): grpc.ServiceDefinition {
    return {
      [options.method]: {
        path: `/${options.service}/${options.method}`,
        requestStream: false,
        responseStream: false,
        requestSerialize: (value: any) => Buffer.from(JSON.stringify(value)),
        requestDeserialize: (value: Buffer) => JSON.parse(value.toString()),
        responseSerialize: (value: any) => Buffer.from(JSON.stringify(value)),
        responseDeserialize: (value: Buffer) => JSON.parse(value.toString())
      }
    };
  }

  unsubscribe(target: event.Target): void {
    this.schedulerUnsubscription(target.id);

    const indexesToRemove = [];

    this.subscriptions.forEach((subscription, index) => {
      const isCwdEqual = subscription.target.cwd == target.cwd;
      const isHandlerEqual = subscription.target.handler == target.handler;
      const isMatchingTarget = target.handler ? isHandlerEqual && isCwdEqual : isCwdEqual;
      if (!isMatchingTarget) return;

      if (subscription.server) {
        subscription.server.tryShutdown(err => {
          if (err) {
            console.error(
              `Error shutting down gRPC server for ${target.cwd}:${target.handler}:`,
              err
            );
          }
        });
      }

      indexesToRemove.push(index);
    });

    for (let i = indexesToRemove.length - 1; i >= 0; i--) {
      this.subscriptions.splice(indexesToRemove[i], 1);
    }
  }

  onEventsAreDrained(events: event.Event[]): Promise<any> {
    if (!this.jobReducer) {
      return Promise.resolve();
    }

    const shiftPromises: Promise<any>[] = [];

    for (const event of events) {
      const shift = this.jobReducer.findOneAndDelete({event_id: event.id}).then(job => {
        if (!job) {
          console.error(`Job with event id ${event.id} does not exist!`);
          return;
        }

        return this.shift(job.request, job.call, event.target.toObject(), job.options, event.id);
      });

      shiftPromises.push(shift);
    }

    return Promise.all(shiftPromises);
  }
}
