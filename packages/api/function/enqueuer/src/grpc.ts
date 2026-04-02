import {EventQueue, GrpcQueue} from "@spica-server/function/queue";
import {event, Grpc} from "@spica-server/function/queue/proto";
import {Enqueuer} from "./enqueuer.js";
import {Description, GrpcOptions, GrpcParam} from "@spica-server/interface/function/enqueuer";
import grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";
import uniqid from "uniqid";
import fs from "fs";
import path from "path";
import os from "os";
import {Logger} from "@nestjs/common";

interface GrpcRegistration {
  target: event.Target;
  options: GrpcOptions;
}

export class GrpcEnqueuer extends Enqueuer<GrpcOptions> {
  type = event.Type.GRPC;
  private readonly logger = new Logger(GrpcEnqueuer.name);

  description: Description = {
    icon: "device_hub",
    name: "grpc",
    title: "gRPC",
    description: "Designed for gRPC unary services"
  };

  private server: grpc.Server | null = null;
  private registrations = new Map<string, GrpcRegistration>();

  constructor(
    private queue: EventQueue,
    private grpcQueue: GrpcQueue,
    private schedulerUnsubscription: (targetId: string) => void,
    private port: number = 50051
  ) {
    super();
  }

  subscribe(target: event.Target, options: GrpcOptions): void {
    const key = `${target.cwd}:${target.handler}`;
    this.registrations.set(key, {target, options});
    this.rebuildServer();
  }

  unsubscribe(target: event.Target): void {
    this.schedulerUnsubscription(target.id);

    const keysToRemove: string[] = [];
    for (const [key, reg] of this.registrations) {
      const isCwdEqual = reg.target.cwd === target.cwd;
      const isHandlerEqual = reg.target.handler === target.handler;
      const isMatchingTarget = target.handler ? isHandlerEqual && isCwdEqual : isCwdEqual;
      if (isMatchingTarget) {
        keysToRemove.push(key);
      }
    }

    for (const key of keysToRemove) {
      this.registrations.delete(key);
    }

    if (this.registrations.size === 0) {
      this.shutdownServer();
    } else {
      this.rebuildServer();
    }
  }

  async onEventsAreDrained(events: event.Event[]): Promise<any> {
    for (const ev of events) {
      const responseCallback = this.grpcQueue.get(ev.id)?.response;
      if (responseCallback) {
        const errorResponse = new Grpc.Response({
          id: ev.id,
          error: "Function worker was drained before completing the request",
          statusCode: grpc.status.UNAVAILABLE
        });
        responseCallback(errorResponse);
        this.grpcQueue.dequeue(ev.id);
      }
    }
  }

  private shutdownServer(): void {
    if (this.server) {
      this.server.tryShutdown(err => {
        if (err) {
          this.logger.error(`Error shutting down gRPC server: ${err.message}`);
          this.server.forceShutdown();
        }
      });
      this.server = null;
    }
  }

  private rebuildServer(): void {
    if (this.server) {
      this.server.forceShutdown();
      this.server = null;
    }

    this.server = new grpc.Server();

    const functionGroups = new Map<string, GrpcRegistration[]>();
    for (const reg of this.registrations.values()) {
      const fnName = this.sanitizeIdentifier(path.basename(reg.target.cwd));
      if (!functionGroups.has(fnName)) {
        functionGroups.set(fnName, []);
      }
      functionGroups.get(fnName).push(reg);
    }

    for (const [serviceName, regs] of functionGroups) {
      this.addServiceToServer(serviceName, regs);
    }

    this.server.bindAsync(
      `0.0.0.0:${this.port}`,
      grpc.ServerCredentials.createInsecure(),
      (err, boundPort) => {
        if (err) {
          this.logger.error(`Failed to bind gRPC server on port ${this.port}: ${err.message}`);
          return;
        }
        this.logger.log(`gRPC trigger server listening on port ${boundPort}`);
      }
    );
  }

  private addServiceToServer(serviceName: string, registrations: GrpcRegistration[]): void {
    const protoContent = this.generateProto(serviceName, registrations);
    const tmpDir = os.tmpdir();
    const protoFile = path.join(tmpDir, `spica_grpc_${serviceName}_${Date.now()}.proto`);

    try {
      fs.writeFileSync(protoFile, protoContent);
      const packageDefinition = protoLoader.loadSync(protoFile, {
        keepCase: true,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true
      });
      const grpcObject = grpc.loadPackageDefinition(packageDefinition);
      const servicePackage = grpcObject[serviceName] as any;
      const serviceDefinition = servicePackage[serviceName];

      const handlers: Record<string, grpc.UntypedHandleCall> = {};
      for (const reg of registrations) {
        const methodName = this.sanitizeIdentifier(reg.target.handler);
        handlers[methodName] = this.createHandler(reg);
      }

      this.server.addService(serviceDefinition.service, handlers);
    } finally {
      try {
        fs.unlinkSync(protoFile);
      } catch {
        // temp file cleanup is best-effort
      }
    }
  }

  private createHandler(reg: GrpcRegistration): grpc.handleUnaryCall<any, any> {
    return (call, callback) => {
      let settled = false;

      const ev = new event.Event({
        target: reg.target,
        type: event.Type.GRPC
      });
      this.queue.enqueue(ev);

      const requestBody = JSON.stringify(call.request);
      const request = new Grpc.Request({
        body: requestBody
      });

      // Clean up when the client cancels or the deadline is exceeded.
      // The gRPC framework automatically sends CANCELLED to the client, so no
      // callback call is needed here — just release the queued entries to
      // prevent memory leaks and avoid executing the function unnecessarily.
      call.on("cancelled", () => {
        if (settled) return;
        settled = true;
        this.queue.dequeue(ev);
        this.grpcQueue.dequeue(ev.id);
      });

      this.grpcQueue.enqueue(ev.id, request, (response: Grpc.Response) => {
        if (settled) return;
        settled = true;

        if (response.error) {
          callback({
            code: response.statusCode || grpc.status.INTERNAL,
            message: response.error
          });
        } else {
          try {
            const responseObj = JSON.parse(response.body);
            callback(null, responseObj);
          } catch {
            callback(null, {});
          }
        }
      });
    };
  }

  private generateProto(serviceName: string, registrations: GrpcRegistration[]): string {
    const lines: string[] = ['syntax = "proto3";', "", `package ${serviceName};`, ""];

    const rpcLines: string[] = [];

    for (const reg of registrations) {
      const methodName = this.sanitizeIdentifier(reg.target.handler);
      const requestMsgName = `${methodName}Request`;
      const responseMsgName = `${methodName}Response`;

      rpcLines.push(`  rpc ${methodName} (${requestMsgName}) returns (${responseMsgName});`);

      lines.push(`message ${requestMsgName} {`);
      if (reg.options.requestParams) {
        reg.options.requestParams.forEach((param, i) => {
          lines.push(`  ${param.type} ${param.name} = ${i + 1};`);
        });
      }
      lines.push("}");
      lines.push("");

      lines.push(`message ${responseMsgName} {`);
      if (reg.options.responseParams) {
        reg.options.responseParams.forEach((param, i) => {
          lines.push(`  ${param.type} ${param.name} = ${i + 1};`);
        });
      }
      lines.push("}");
      lines.push("");
    }

    lines.push(`service ${serviceName} {`);
    lines.push(...rpcLines);
    lines.push("}");
    lines.push("");

    return lines.join("\n");
  }

  private sanitizeIdentifier(name: string): string {
    return name.replace(/[^a-zA-Z0-9_]/g, "_");
  }
}
