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

interface GrpcCallHandler {
  sendMetadata: (metadata: grpc.Metadata) => void;
  sendMessage: (message: any) => void;
  sendError: (error: any) => void;
  end: () => void;
  cancelled: boolean;
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

      if (options.port < 1024 || options.port > 65535) {
        throw new Error(
          `Invalid port number: ${options.port}. Port must be between 1024 and 65535.`
        );
      }
      const credentials = this.buildServerCredentials(options);

      await new Promise<void>((resolve, reject) => {
        server.bindAsync(`${host}:${port}`, credentials, (err, port) => {
          if (err) {
            reject(err);
            return;
          }
          server.start();
          console.log(
            `gRPC server for ${options.service}.${options.method} started on port ${port}`
          );
          resolve();
        });
      });
    } catch (err) {
      this.setAsClosed(subscription, target, `Failed to start gRPC server: ${err.message}`);
    }
  }

  private buildServerCredentials(options: GrpcOptions): grpc.ServerCredentials {
    try {
      const hasKey = Boolean(options.key);
      const hasCert = Boolean(options.cert);

      if (!hasKey || !hasCert) {
        console.warn(
          `gRPC server for ${options.service}.${options.method} is running without secure connection. Consider providing TLS credentials.`
        );
        return grpc.ServerCredentials.createInsecure();
      }

      const privateKey: Buffer = Buffer.from(options.key);
      const certChain: Buffer = Buffer.from(options.cert);

      const rootCerts: Buffer | null = options.ca ? Buffer.from(options.ca) : null;

      const checkClientCert = Boolean(options.requestClientCert);

      return grpc.ServerCredentials.createSsl(
        rootCerts,
        [
          {
            private_key: privateKey,
            cert_chain: certChain
          }
        ],
        checkClientCert
      );
    } catch (err) {
      console.error(
        "Failed to load TLS credentials for gRPC server, falling back to insecure:",
        err
      );
      return grpc.ServerCredentials.createInsecure();
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

    const metadataArray = this.convertMetadataToHeaders(call.metadata.getMap());

    const request = new Grpc.Request({
      id: ev.id,
      service: options.service,
      method: options.method,
      payload: this.serializeJson(call.request),
      metadata: metadataArray
    });

    const grpcCall: GrpcCallHandler = {
      sendMetadata: (metadata: grpc.Metadata) => {
        call.sendMetadata(metadata);
      },
      sendMessage: (message: any) => {
        callback(null, message);
      },
      sendError: (error: any) => {
        callback(error, null);
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
    rawCall: GrpcCallHandler,
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
        env: target.context.env.map(
          envVar =>
            new event.SchedulingContext.Env({
              key: envVar.key,
              value: envVar.value
            })
        ),
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

  private convertMetadataToHeaders(metadataMap: {
    [key: string]: grpc.MetadataValue;
  }): Grpc.Header[] {
    return Object.keys(metadataMap).map(key => {
      const value = metadataMap[key];
      const header = new Grpc.Header();
      header.key = key;
      header.value = this.extractMetadataValue(value);
      return header;
    });
  }

  private extractMetadataValue(value: grpc.MetadataValue): string {
    if (Array.isArray(value)) {
      return value.length > 0 ? String(value[0]) : "";
    }

    return String(value);
  }

  private serializeJson(value: any): Buffer {
    try {
      return Buffer.from(JSON.stringify(value));
    } catch (err) {
      throw new Error(`Failed to serialize gRPC message: ${err.message}`);
    }
  }

  private deserializeJson(buffer: Buffer) {
    try {
      return Buffer.from(JSON.parse(buffer.toString()));
    } catch (err) {
      throw new Error(`Failed to deserialize gRPC message: ${err.message}`);
    }
  }

  private createServiceDefinition(options: GrpcOptions): grpc.ServiceDefinition {
    return {
      [options.method]: {
        path: `/${options.service}/${options.method}`,
        requestStream: false,
        responseStream: false,
        requestSerialize: (value: any) => this.serializeJson(value),
        requestDeserialize: (value: Buffer) => this.deserializeJson(value),
        responseSerialize: (value: any) => this.serializeJson(value),
        responseDeserialize: (value: Buffer) => this.deserializeJson(value)
      }
    };
  }

  unsubscribe(target: event.Target): void {
    this.schedulerUnsubscription(target.id);

    this.subscriptions = this.subscriptions.filter(subscription => {
      const isCwdEqual = subscription.target.cwd === target.cwd;
      const isHandlerEqual = subscription.target.handler === target.handler;
      const isMatchingTarget = target.handler ? isHandlerEqual && isCwdEqual : isCwdEqual;

      if (!isMatchingTarget) {
        return true;
      }

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

      return false;
    });
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
