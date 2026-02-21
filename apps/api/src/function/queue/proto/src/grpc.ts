import pb_1 from "google-protobuf";
import grpc_1 from "@grpc/grpc-js";

export namespace Grpc {
  export class Header extends pb_1.Message {
    constructor(
      data?:
        | any[]
        | {
            key?: string;
            value?: string;
          }
    ) {
      super();
      pb_1.Message.initialize(this, Array.isArray(data) && data, 0, -1, [], null);
      if (!Array.isArray(data) && typeof data == "object") {
        this.key = data.key;
        this.value = data.value;
      }
    }
    get key(): string | undefined {
      return pb_1.Message.getFieldWithDefault(this, 1, undefined) as string | undefined;
    }
    set key(value: string) {
      pb_1.Message.setField(this, 1, value);
    }
    get value(): string | undefined {
      return pb_1.Message.getFieldWithDefault(this, 2, undefined) as string | undefined;
    }
    set value(value: string) {
      pb_1.Message.setField(this, 2, value);
    }
    toObject() {
      return {
        key: this.key,
        value: this.value
      };
    }
    serialize(w?: pb_1.BinaryWriter): Uint8Array | undefined {
      const writer = w || new pb_1.BinaryWriter();
      if (this.key !== undefined) writer.writeString(1, this.key);
      if (this.value !== undefined) writer.writeString(2, this.value);
      if (!w) return writer.getResultBuffer();
    }
    static deserialize(bytes: Uint8Array | pb_1.BinaryReader): Header {
      const reader = bytes instanceof Uint8Array ? new pb_1.BinaryReader(bytes) : bytes,
        message = new Header();
      while (reader.nextField()) {
        if (reader.isEndGroup()) break;
        switch (reader.getFieldNumber()) {
          case 1:
            message.key = reader.readString();
            break;
          case 2:
            message.value = reader.readString();
            break;
          default:
            reader.skipField();
        }
      }
      return message;
    }
  }

  export class Request extends pb_1.Message {
    constructor(
      data?:
        | any[]
        | {
            id?: string;
            service?: string;
            method?: string;
            payload?: Uint8Array;
            metadata?: Header[];
          }
    ) {
      super();
      pb_1.Message.initialize(this, Array.isArray(data) && data, 0, -1, [5], null);
      if (!Array.isArray(data) && typeof data == "object") {
        this.id = data.id;
        this.service = data.service;
        this.method = data.method;
        this.payload = data.payload;
        this.metadata = data.metadata;
      }
    }
    get id(): string | undefined {
      return pb_1.Message.getFieldWithDefault(this, 1, undefined) as string | undefined;
    }
    set id(value: string) {
      pb_1.Message.setField(this, 1, value);
    }
    get service(): string | undefined {
      return pb_1.Message.getFieldWithDefault(this, 2, undefined) as string | undefined;
    }
    set service(value: string) {
      pb_1.Message.setField(this, 2, value);
    }
    get method(): string | undefined {
      return pb_1.Message.getFieldWithDefault(this, 3, undefined) as string | undefined;
    }
    set method(value: string) {
      pb_1.Message.setField(this, 3, value);
    }
    get payload(): Uint8Array | undefined {
      return pb_1.Message.getFieldWithDefault(this, 4, undefined) as Uint8Array | undefined;
    }
    set payload(value: Uint8Array) {
      pb_1.Message.setField(this, 4, value);
    }
    get metadata(): Header[] {
      return pb_1.Message.getRepeatedWrapperField(this, Header, 5) as Header[];
    }
    set metadata(value: Header[]) {
      pb_1.Message.setRepeatedWrapperField(this, 5, value);
    }
    toObject() {
      return {
        id: this.id,
        service: this.service,
        method: this.method,
        payload: this.payload,
        metadata: this.metadata.map(item => item.toObject())
      };
    }
    serialize(w?: pb_1.BinaryWriter): Uint8Array | undefined {
      const writer = w || new pb_1.BinaryWriter();
      if (this.id !== undefined) writer.writeString(1, this.id);
      if (this.service !== undefined) writer.writeString(2, this.service);
      if (this.method !== undefined) writer.writeString(3, this.method);
      if (this.payload !== undefined) writer.writeBytes(4, this.payload);
      if (this.metadata.length)
        writer.writeRepeatedMessage(5, this.metadata, (item: Header) => item.serialize(writer));
      if (!w) return writer.getResultBuffer();
    }
    static deserialize(bytes: Uint8Array | pb_1.BinaryReader): Request {
      const reader = bytes instanceof Uint8Array ? new pb_1.BinaryReader(bytes) : bytes,
        message = new Request();
      while (reader.nextField()) {
        if (reader.isEndGroup()) break;
        switch (reader.getFieldNumber()) {
          case 1:
            message.id = reader.readString();
            break;
          case 2:
            message.service = reader.readString();
            break;
          case 3:
            message.method = reader.readString();
            break;
          case 4:
            message.payload = reader.readBytes();
            break;
          case 5:
            reader.readMessage(message.metadata, () =>
              pb_1.Message.addToRepeatedWrapperField(message, 5, Header.deserialize(reader), Header)
            );
            break;
          default:
            reader.skipField();
        }
      }
      return message;
    }
  }

  export namespace Request {
    export class Pop extends pb_1.Message {
      constructor(
        data?:
          | any[]
          | {
              id?: string;
            }
      ) {
        super();
        pb_1.Message.initialize(this, Array.isArray(data) && data, 0, -1, [], null);
        if (!Array.isArray(data) && typeof data == "object") {
          this.id = data.id;
        }
      }
      get id(): string | undefined {
        return pb_1.Message.getFieldWithDefault(this, 1, undefined) as string | undefined;
      }
      set id(value: string) {
        pb_1.Message.setField(this, 1, value);
      }
      toObject() {
        return {
          id: this.id
        };
      }
      serialize(w?: pb_1.BinaryWriter): Uint8Array | undefined {
        const writer = w || new pb_1.BinaryWriter();
        if (this.id !== undefined) writer.writeString(1, this.id);
        if (!w) return writer.getResultBuffer();
      }
      static deserialize(bytes: Uint8Array | pb_1.BinaryReader): Pop {
        const reader = bytes instanceof Uint8Array ? new pb_1.BinaryReader(bytes) : bytes,
          message = new Pop();
        while (reader.nextField()) {
          if (reader.isEndGroup()) break;
          switch (reader.getFieldNumber()) {
            case 1:
              message.id = reader.readString();
              break;
            default:
              reader.skipField();
          }
        }
        return message;
      }
    }
  }

  export class Response extends pb_1.Message {
    constructor(
      data?:
        | any[]
        | {
            id?: string;
            status?: number;
            data?: Uint8Array;
            metadata?: Header[];
          }
    ) {
      super();
      pb_1.Message.initialize(this, Array.isArray(data) && data, 0, -1, [4], null);
      if (!Array.isArray(data) && typeof data == "object") {
        this.id = data.id;
        this.status = data.status;
        this.data = data.data;
        this.metadata = data.metadata;
      }
    }
    get id(): string | undefined {
      return pb_1.Message.getFieldWithDefault(this, 1, undefined) as string | undefined;
    }
    set id(value: string) {
      pb_1.Message.setField(this, 1, value);
    }
    get status(): number | undefined {
      return pb_1.Message.getFieldWithDefault(this, 2, undefined) as number | undefined;
    }
    set status(value: number) {
      pb_1.Message.setField(this, 2, value);
    }
    get data(): Uint8Array | undefined {
      return pb_1.Message.getFieldWithDefault(this, 3, undefined) as Uint8Array | undefined;
    }
    set data(value: Uint8Array) {
      pb_1.Message.setField(this, 3, value);
    }
    get metadata(): Header[] {
      return pb_1.Message.getRepeatedWrapperField(this, Header, 4) as Header[];
    }
    set metadata(value: Header[]) {
      pb_1.Message.setRepeatedWrapperField(this, 4, value);
    }
    toObject() {
      return {
        id: this.id,
        status: this.status,
        data: this.data,
        metadata: this.metadata.map(item => item.toObject())
      };
    }
    serialize(w?: pb_1.BinaryWriter): Uint8Array | undefined {
      const writer = w || new pb_1.BinaryWriter();
      if (this.id !== undefined) writer.writeString(1, this.id);
      if (this.status !== undefined) writer.writeInt32(2, this.status);
      if (this.data !== undefined) writer.writeBytes(3, this.data);
      if (this.metadata.length)
        writer.writeRepeatedMessage(4, this.metadata, (item: Header) => item.serialize(writer));
      if (!w) return writer.getResultBuffer();
    }
    static deserialize(bytes: Uint8Array | pb_1.BinaryReader): Response {
      const reader = bytes instanceof Uint8Array ? new pb_1.BinaryReader(bytes) : bytes,
        message = new Response();
      while (reader.nextField()) {
        if (reader.isEndGroup()) break;
        switch (reader.getFieldNumber()) {
          case 1:
            message.id = reader.readString();
            break;
          case 2:
            message.status = reader.readInt32();
            break;
          case 3:
            message.data = reader.readBytes();
            break;
          case 4:
            reader.readMessage(message.metadata, () =>
              pb_1.Message.addToRepeatedWrapperField(message, 4, Header.deserialize(reader), Header)
            );
            break;
          default:
            reader.skipField();
        }
      }
      return message;
    }
  }

  export namespace Response {
    export class Result extends pb_1.Message {
      constructor(data?: any[] | {}) {
        super();
        pb_1.Message.initialize(this, Array.isArray(data) && data, 0, -1, [], null);
      }
      toObject() {
        return {};
      }
      serialize(w?: pb_1.BinaryWriter): Uint8Array | undefined {
        const writer = w || new pb_1.BinaryWriter();
        if (!w) return writer.getResultBuffer();
      }
      static deserialize(bytes: Uint8Array | pb_1.BinaryReader): Result {
        const reader = bytes instanceof Uint8Array ? new pb_1.BinaryReader(bytes) : bytes,
          message = new Result();
        while (reader.nextField()) {
          if (reader.isEndGroup()) break;
          reader.skipField();
        }
        return message;
      }
    }
  }

  export class Error extends pb_1.Message {
    constructor(
      data?:
        | any[]
        | {
            id?: string;
            code?: number;
            message?: string;
            metadata?: Header[];
          }
    ) {
      super();
      pb_1.Message.initialize(this, Array.isArray(data) && data, 0, -1, [4], null);
      if (!Array.isArray(data) && typeof data == "object") {
        this.id = data.id;
        this.code = data.code;
        this.message = data.message;
        this.metadata = data.metadata;
      }
    }
    get id(): string | undefined {
      return pb_1.Message.getFieldWithDefault(this, 1, undefined) as string | undefined;
    }
    set id(value: string) {
      pb_1.Message.setField(this, 1, value);
    }
    get code(): number | undefined {
      return pb_1.Message.getFieldWithDefault(this, 2, undefined) as number | undefined;
    }
    set code(value: number) {
      pb_1.Message.setField(this, 2, value);
    }
    get message(): string | undefined {
      return pb_1.Message.getFieldWithDefault(this, 3, undefined) as string | undefined;
    }
    set message(value: string) {
      pb_1.Message.setField(this, 3, value);
    }
    get metadata(): Header[] {
      return pb_1.Message.getRepeatedWrapperField(this, Header, 4) as Header[];
    }
    set metadata(value: Header[]) {
      pb_1.Message.setRepeatedWrapperField(this, 4, value);
    }
    toObject() {
      return {
        id: this.id,
        code: this.code,
        message: this.message,
        metadata: this.metadata.map(item => item.toObject())
      };
    }
    serialize(w?: pb_1.BinaryWriter): Uint8Array | undefined {
      const writer = w || new pb_1.BinaryWriter();
      if (this.id !== undefined) writer.writeString(1, this.id);
      if (this.code !== undefined) writer.writeInt32(2, this.code);
      if (this.message !== undefined) writer.writeString(3, this.message);
      if (this.metadata.length)
        writer.writeRepeatedMessage(4, this.metadata, (item: Header) => item.serialize(writer));
      if (!w) return writer.getResultBuffer();
    }
    static deserialize(bytes: Uint8Array | pb_1.BinaryReader): Error {
      const reader = bytes instanceof Uint8Array ? new pb_1.BinaryReader(bytes) : bytes,
        message = new Error();
      while (reader.nextField()) {
        if (reader.isEndGroup()) break;
        switch (reader.getFieldNumber()) {
          case 1:
            message.id = reader.readString();
            break;
          case 2:
            message.code = reader.readInt32();
            break;
          case 3:
            message.message = reader.readString();
            break;
          case 4:
            reader.readMessage(message.metadata, () =>
              pb_1.Message.addToRepeatedWrapperField(message, 4, Header.deserialize(reader), Header)
            );
            break;
          default:
            reader.skipField();
        }
      }
      return message;
    }
  }

  export namespace Error {
    export class Result extends pb_1.Message {
      constructor(data?: any[] | {}) {
        super();
        pb_1.Message.initialize(this, Array.isArray(data) && data, 0, -1, [], null);
      }
      toObject() {
        return {};
      }
      serialize(w?: pb_1.BinaryWriter): Uint8Array | undefined {
        const writer = w || new pb_1.BinaryWriter();
        if (!w) return writer.getResultBuffer();
      }
      static deserialize(bytes: Uint8Array | pb_1.BinaryReader): Result {
        const reader = bytes instanceof Uint8Array ? new pb_1.BinaryReader(bytes) : bytes,
          message = new Result();
        while (reader.nextField()) {
          if (reader.isEndGroup()) break;
          reader.skipField();
        }
        return message;
      }
    }
  }

  interface GrpcUnaryServiceInterface<P, R> {
    (
      message: P,
      metadata: grpc_1.Metadata,
      options: grpc_1.CallOptions,
      callback: grpc_1.requestCallback<R>
    ): grpc_1.ClientUnaryCall;
    (
      message: P,
      metadata: grpc_1.Metadata,
      callback: grpc_1.requestCallback<R>
    ): grpc_1.ClientUnaryCall;
    (
      message: P,
      options: grpc_1.CallOptions,
      callback: grpc_1.requestCallback<R>
    ): grpc_1.ClientUnaryCall;
    (message: P, callback: grpc_1.requestCallback<R>): grpc_1.ClientUnaryCall;
  }

  export abstract class UnimplementedQueueService {
    static definition = {
      pop: {
        path: "/Grpc.Queue/pop",
        requestStream: false,
        responseStream: false,
        requestSerialize: (message: Request.Pop) => Buffer.from(message.serialize()),
        requestDeserialize: (bytes: Buffer) => Request.Pop.deserialize(new Uint8Array(bytes)),
        responseSerialize: (message: Request) => Buffer.from(message.serialize()),
        responseDeserialize: (bytes: Buffer) => Request.deserialize(new Uint8Array(bytes))
      },
      sendResponse: {
        path: "/Grpc.Queue/sendResponse",
        requestStream: false,
        responseStream: false,
        requestSerialize: (message: Response) => Buffer.from(message.serialize()),
        requestDeserialize: (bytes: Buffer) => Response.deserialize(new Uint8Array(bytes)),
        responseSerialize: (message: Response.Result) => Buffer.from(message.serialize()),
        responseDeserialize: (bytes: Buffer) => Response.Result.deserialize(new Uint8Array(bytes))
      },
      sendError: {
        path: "/Grpc.Queue/sendError",
        requestStream: false,
        responseStream: false,
        requestSerialize: (message: Error) => Buffer.from(message.serialize()),
        requestDeserialize: (bytes: Buffer) => Error.deserialize(new Uint8Array(bytes)),
        responseSerialize: (message: Error.Result) => Buffer.from(message.serialize()),
        responseDeserialize: (bytes: Buffer) => Error.Result.deserialize(new Uint8Array(bytes))
      }
    };
    [method: string]: grpc_1.UntypedHandleCall;
    abstract pop(
      call: grpc_1.ServerUnaryCall<Request.Pop, Request>,
      callback: grpc_1.sendUnaryData<Request>
    ): void;
    abstract sendResponse(
      call: grpc_1.ServerUnaryCall<Response, Response.Result>,
      callback: grpc_1.sendUnaryData<Response.Result>
    ): void;
    abstract sendError(
      call: grpc_1.ServerUnaryCall<Error, Error.Result>,
      callback: grpc_1.sendUnaryData<Error.Result>
    ): void;
  }

  export class QueueClient extends grpc_1.makeGenericClientConstructor(
    UnimplementedQueueService.definition,
    "Queue",
    {}
  ) {
    constructor(
      address: string,
      credentials: grpc_1.ChannelCredentials,
      options?: Partial<grpc_1.ChannelOptions>
    ) {
      super(address, credentials, options);
    }
    pop: GrpcUnaryServiceInterface<Request.Pop, Request>;
    sendResponse: GrpcUnaryServiceInterface<Response, Response.Result>;
    sendError: GrpcUnaryServiceInterface<Error, Error.Result>;
  }
}
