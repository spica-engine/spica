import * as pb_1 from "google-protobuf";
import * as grpc_1 from "@grpc/grpc-js";

export namespace Firehose {
  export class Message extends pb_1.Message {
    constructor(
      data?:
        | any[]
        | {
            name?: string;
            data?: string;
          }
    ) {
      super();
      pb_1.Message.initialize(this, Array.isArray(data) && data, 0, -1, [], null);
      if (!Array.isArray(data) && typeof data == "object") {
        this.name = data.name;
        this.data = data.data;
      }
    }
    get name(): string | undefined {
      return pb_1.Message.getFieldWithDefault(this, 1, undefined) as string | undefined;
    }
    set name(value: string) {
      pb_1.Message.setField(this, 1, value);
    }
    get data(): string | undefined {
      return pb_1.Message.getFieldWithDefault(this, 2, undefined) as string | undefined;
    }
    set data(value: string) {
      pb_1.Message.setField(this, 2, value);
    }
    toObject() {
      return {
        name: this.name,
        data: this.data
      };
    }
    serialize(w?: pb_1.BinaryWriter): Uint8Array | undefined {
      const writer = w || new pb_1.BinaryWriter();
      if (this.name) writer.writeString(1, this.name);
      if (this.data) writer.writeString(2, this.data);
      if (!w) return writer.getResultBuffer();
    }
    static deserialize(bytes: Uint8Array | pb_1.BinaryReader): Message {
      const reader = bytes instanceof Uint8Array ? new pb_1.BinaryReader(bytes) : bytes,
        message = new Message();
      while (reader.nextField()) {
        if (reader.isEndGroup()) break;
        switch (reader.getFieldNumber()) {
          case 1:
            message.name = reader.readString();
            break;
          case 2:
            message.data = reader.readString();
            break;
          default:
            reader.skipField();
        }
      }
      return message;
    }
  }
  export namespace Message {
    export class Incoming extends pb_1.Message {
      constructor(
        data?:
          | any[]
          | {
              client?: ClientDescription;
              pool?: PoolDescription;
              message?: Message;
            }
      ) {
        super();
        pb_1.Message.initialize(this, Array.isArray(data) && data, 0, -1, [], null);
        if (!Array.isArray(data) && typeof data == "object") {
          this.client = data.client;
          this.pool = data.pool;
          this.message = data.message;
        }
      }
      get client(): ClientDescription | undefined {
        return pb_1.Message.getWrapperField(this, ClientDescription, 1) as
          | ClientDescription
          | undefined;
      }
      set client(value: ClientDescription) {
        pb_1.Message.setWrapperField(this, 1, value);
      }
      get pool(): PoolDescription | undefined {
        return pb_1.Message.getWrapperField(this, PoolDescription, 2) as
          | PoolDescription
          | undefined;
      }
      set pool(value: PoolDescription) {
        pb_1.Message.setWrapperField(this, 2, value);
      }
      get message(): Message | undefined {
        return pb_1.Message.getWrapperField(this, Message, 3) as Message | undefined;
      }
      set message(value: Message) {
        pb_1.Message.setWrapperField(this, 3, value);
      }
      toObject() {
        return {
          client: this.client && this.client.toObject(),
          pool: this.pool && this.pool.toObject(),
          message: this.message && this.message.toObject()
        };
      }
      serialize(w?: pb_1.BinaryWriter): Uint8Array | undefined {
        const writer = w || new pb_1.BinaryWriter();
        if (this.client) writer.writeMessage(1, this.client, () => this.client.serialize(writer));
        if (this.pool) writer.writeMessage(2, this.pool, () => this.pool.serialize(writer));
        if (this.message)
          writer.writeMessage(3, this.message, () => this.message.serialize(writer));
        if (!w) return writer.getResultBuffer();
      }
      static deserialize(bytes: Uint8Array | pb_1.BinaryReader): Incoming {
        const reader = bytes instanceof Uint8Array ? new pb_1.BinaryReader(bytes) : bytes,
          message = new Incoming();
        while (reader.nextField()) {
          if (reader.isEndGroup()) break;
          switch (reader.getFieldNumber()) {
            case 1:
              reader.readMessage(
                message.client,
                () => (message.client = ClientDescription.deserialize(reader))
              );
              break;
            case 2:
              reader.readMessage(
                message.pool,
                () => (message.pool = PoolDescription.deserialize(reader))
              );
              break;
            case 3:
              reader.readMessage(
                message.message,
                () => (message.message = Message.deserialize(reader))
              );
              break;
            default:
              reader.skipField();
          }
        }
        return message;
      }
    }
    export class Outgoing extends pb_1.Message {
      constructor(
        data?:
          | any[]
          | {
              client?: ClientDescription;
              message?: Message;
            }
      ) {
        super();
        pb_1.Message.initialize(this, Array.isArray(data) && data, 0, -1, [], null);
        if (!Array.isArray(data) && typeof data == "object") {
          this.client = data.client;
          this.message = data.message;
        }
      }
      get client(): ClientDescription | undefined {
        return pb_1.Message.getWrapperField(this, ClientDescription, 1) as
          | ClientDescription
          | undefined;
      }
      set client(value: ClientDescription) {
        pb_1.Message.setWrapperField(this, 1, value);
      }
      get message(): Message | undefined {
        return pb_1.Message.getWrapperField(this, Message, 2) as Message | undefined;
      }
      set message(value: Message) {
        pb_1.Message.setWrapperField(this, 2, value);
      }
      toObject() {
        return {
          client: this.client && this.client.toObject(),
          message: this.message && this.message.toObject()
        };
      }
      serialize(w?: pb_1.BinaryWriter): Uint8Array | undefined {
        const writer = w || new pb_1.BinaryWriter();
        if (this.client) writer.writeMessage(1, this.client, () => this.client.serialize(writer));
        if (this.message)
          writer.writeMessage(2, this.message, () => this.message.serialize(writer));
        if (!w) return writer.getResultBuffer();
      }
      static deserialize(bytes: Uint8Array | pb_1.BinaryReader): Outgoing {
        const reader = bytes instanceof Uint8Array ? new pb_1.BinaryReader(bytes) : bytes,
          message = new Outgoing();
        while (reader.nextField()) {
          if (reader.isEndGroup()) break;
          switch (reader.getFieldNumber()) {
            case 1:
              reader.readMessage(
                message.client,
                () => (message.client = ClientDescription.deserialize(reader))
              );
              break;
            case 2:
              reader.readMessage(
                message.message,
                () => (message.message = Message.deserialize(reader))
              );
              break;
            default:
              reader.skipField();
          }
        }
        return message;
      }
    }
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
        if (this.id) writer.writeString(1, this.id);
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
    export class Result extends pb_1.Message {
      constructor(data?: any[] | {}) {
        super();
        pb_1.Message.initialize(this, Array.isArray(data) && data, 0, -1, [], null);
        if (!Array.isArray(data) && typeof data == "object") {
        }
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
          switch (reader.getFieldNumber()) {
            default:
              reader.skipField();
          }
        }
        return message;
      }
    }
  }
  export class PoolDescription extends pb_1.Message {
    constructor(
      data?:
        | any[]
        | {
            size?: number;
          }
    ) {
      super();
      pb_1.Message.initialize(this, Array.isArray(data) && data, 0, -1, [], null);
      if (!Array.isArray(data) && typeof data == "object") {
        this.size = data.size;
      }
    }
    get size(): number | undefined {
      return pb_1.Message.getFieldWithDefault(this, 1, undefined) as number | undefined;
    }
    set size(value: number) {
      pb_1.Message.setField(this, 1, value);
    }
    toObject() {
      return {
        size: this.size
      };
    }
    serialize(w?: pb_1.BinaryWriter): Uint8Array | undefined {
      const writer = w || new pb_1.BinaryWriter();
      if (this.size) writer.writeInt64(1, this.size);
      if (!w) return writer.getResultBuffer();
    }
    static deserialize(bytes: Uint8Array | pb_1.BinaryReader): PoolDescription {
      const reader = bytes instanceof Uint8Array ? new pb_1.BinaryReader(bytes) : bytes,
        message = new PoolDescription();
      while (reader.nextField()) {
        if (reader.isEndGroup()) break;
        switch (reader.getFieldNumber()) {
          case 1:
            message.size = reader.readInt64();
            break;
          default:
            reader.skipField();
        }
      }
      return message;
    }
  }
  export class ClientDescription extends pb_1.Message {
    constructor(
      data?:
        | any[]
        | {
            id?: string;
            remoteAddress?: string;
          }
    ) {
      super();
      pb_1.Message.initialize(this, Array.isArray(data) && data, 0, -1, [], null);
      if (!Array.isArray(data) && typeof data == "object") {
        this.id = data.id;
        this.remoteAddress = data.remoteAddress;
      }
    }
    get id(): string | undefined {
      return pb_1.Message.getFieldWithDefault(this, 1, undefined) as string | undefined;
    }
    set id(value: string) {
      pb_1.Message.setField(this, 1, value);
    }
    get remoteAddress(): string | undefined {
      return pb_1.Message.getFieldWithDefault(this, 2, undefined) as string | undefined;
    }
    set remoteAddress(value: string) {
      pb_1.Message.setField(this, 2, value);
    }
    toObject() {
      return {
        id: this.id,
        remoteAddress: this.remoteAddress
      };
    }
    serialize(w?: pb_1.BinaryWriter): Uint8Array | undefined {
      const writer = w || new pb_1.BinaryWriter();
      if (this.id) writer.writeString(1, this.id);
      if (this.remoteAddress) writer.writeString(2, this.remoteAddress);
      if (!w) return writer.getResultBuffer();
    }
    static deserialize(bytes: Uint8Array | pb_1.BinaryReader): ClientDescription {
      const reader = bytes instanceof Uint8Array ? new pb_1.BinaryReader(bytes) : bytes,
        message = new ClientDescription();
      while (reader.nextField()) {
        if (reader.isEndGroup()) break;
        switch (reader.getFieldNumber()) {
          case 1:
            message.id = reader.readString();
            break;
          case 2:
            message.remoteAddress = reader.readString();
            break;
          default:
            reader.skipField();
        }
      }
      return message;
    }
  }
  export class Close extends pb_1.Message {
    constructor(
      data?:
        | any[]
        | {
            client?: ClientDescription;
          }
    ) {
      super();
      pb_1.Message.initialize(this, Array.isArray(data) && data, 0, -1, [], null);
      if (!Array.isArray(data) && typeof data == "object") {
        this.client = data.client;
      }
    }
    get client(): ClientDescription | undefined {
      return pb_1.Message.getWrapperField(this, ClientDescription, 1) as
        | ClientDescription
        | undefined;
    }
    set client(value: ClientDescription) {
      pb_1.Message.setWrapperField(this, 1, value);
    }
    toObject() {
      return {
        client: this.client && this.client.toObject()
      };
    }
    serialize(w?: pb_1.BinaryWriter): Uint8Array | undefined {
      const writer = w || new pb_1.BinaryWriter();
      if (this.client) writer.writeMessage(1, this.client, () => this.client.serialize(writer));
      if (!w) return writer.getResultBuffer();
    }
    static deserialize(bytes: Uint8Array | pb_1.BinaryReader): Close {
      const reader = bytes instanceof Uint8Array ? new pb_1.BinaryReader(bytes) : bytes,
        message = new Close();
      while (reader.nextField()) {
        if (reader.isEndGroup()) break;
        switch (reader.getFieldNumber()) {
          case 1:
            reader.readMessage(
              message.client,
              () => (message.client = ClientDescription.deserialize(reader))
            );
            break;
          default:
            reader.skipField();
        }
      }
      return message;
    }
  }
  export namespace Close {
    export class Result extends pb_1.Message {
      constructor(data?: any[] | {}) {
        super();
        pb_1.Message.initialize(this, Array.isArray(data) && data, 0, -1, [], null);
        if (!Array.isArray(data) && typeof data == "object") {
        }
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
          switch (reader.getFieldNumber()) {
            default:
              reader.skipField();
          }
        }
        return message;
      }
    }
  }
  export const Queue = {
    pop: {
      path: "/Firehose/Queue/pop",
      requestStream: false,
      responseStream: false,
      requestType: Firehose.Message.Pop,
      responseType: Firehose.Message.Incoming,
      requestSerialize: (message: Message.Pop) => Buffer.from(message.serialize()),
      requestDeserialize: (bytes: Buffer) => Message.Pop.deserialize(new Uint8Array(bytes)),
      responseSerialize: (message: Message.Incoming) => Buffer.from(message.serialize()),
      responseDeserialize: (bytes: Buffer) => Message.Incoming.deserialize(new Uint8Array(bytes))
    },
    close: {
      path: "/Firehose/Queue/close",
      requestStream: false,
      responseStream: false,
      requestType: Firehose.Close,
      responseType: Firehose.Close.Result,
      requestSerialize: (message: Close) => Buffer.from(message.serialize()),
      requestDeserialize: (bytes: Buffer) => Close.deserialize(new Uint8Array(bytes)),
      responseSerialize: (message: Close.Result) => Buffer.from(message.serialize()),
      responseDeserialize: (bytes: Buffer) => Close.Result.deserialize(new Uint8Array(bytes))
    },
    send: {
      path: "/Firehose/Queue/send",
      requestStream: false,
      responseStream: false,
      requestType: Firehose.Message.Outgoing,
      responseType: Firehose.Message.Result,
      requestSerialize: (message: Message.Outgoing) => Buffer.from(message.serialize()),
      requestDeserialize: (bytes: Buffer) => Message.Outgoing.deserialize(new Uint8Array(bytes)),
      responseSerialize: (message: Message.Result) => Buffer.from(message.serialize()),
      responseDeserialize: (bytes: Buffer) => Message.Result.deserialize(new Uint8Array(bytes))
    },
    sendAll: {
      path: "/Firehose/Queue/sendAll",
      requestStream: false,
      responseStream: false,
      requestType: Firehose.Message,
      responseType: Firehose.Message.Result,
      requestSerialize: (message: Message) => Buffer.from(message.serialize()),
      requestDeserialize: (bytes: Buffer) => Message.deserialize(new Uint8Array(bytes)),
      responseSerialize: (message: Message.Result) => Buffer.from(message.serialize()),
      responseDeserialize: (bytes: Buffer) => Message.Result.deserialize(new Uint8Array(bytes))
    }
  };
  export const QueueClient: any = grpc_1.makeGenericClientConstructor(Queue, "Queue", {});
}
