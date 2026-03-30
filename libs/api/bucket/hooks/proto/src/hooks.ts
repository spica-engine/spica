import pb_1 from "google-protobuf";
import grpc_1 from "@grpc/grpc-js";

export namespace hooks {
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
    serializeBinary(): Uint8Array {
      throw new Error("Method not implemented.");
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

  export class Change extends pb_1.Message {
    constructor(
      data?:
        | any[]
        | {
            kind?: Change.Kind;
            bucket?: string;
            documentKey?: string;
            previous?: string;
            current?: string;
          }
    ) {
      super();
      pb_1.Message.initialize(this, Array.isArray(data) && data, 0, -1, [], null);
      if (!Array.isArray(data) && typeof data == "object") {
        this.kind = data.kind;
        this.bucket = data.bucket;
        this.documentKey = data.documentKey;
        this.previous = data.previous;
        this.current = data.current;
      }
    }
    get kind(): Change.Kind | undefined {
      return pb_1.Message.getFieldWithDefault(this, 1, undefined) as Change.Kind | undefined;
    }
    set kind(value: Change.Kind) {
      pb_1.Message.setField(this, 1, value);
    }
    get bucket(): string | undefined {
      return pb_1.Message.getFieldWithDefault(this, 2, undefined) as string | undefined;
    }
    set bucket(value: string) {
      pb_1.Message.setField(this, 2, value);
    }
    get documentKey(): string | undefined {
      return pb_1.Message.getFieldWithDefault(this, 3, undefined) as string | undefined;
    }
    set documentKey(value: string) {
      pb_1.Message.setField(this, 3, value);
    }
    get previous(): string | undefined {
      return pb_1.Message.getFieldWithDefault(this, 4, undefined) as string | undefined;
    }
    set previous(value: string) {
      pb_1.Message.setField(this, 4, value);
    }
    get current(): string | undefined {
      return pb_1.Message.getFieldWithDefault(this, 5, undefined) as string | undefined;
    }
    set current(value: string) {
      pb_1.Message.setField(this, 5, value);
    }
    toObject() {
      return {
        kind: this.kind,
        bucket: this.bucket,
        documentKey: this.documentKey,
        previous: this.previous,
        current: this.current
      };
    }
    serialize(w?: pb_1.BinaryWriter): Uint8Array | undefined {
      const writer = w || new pb_1.BinaryWriter();
      if (this.kind !== undefined) writer.writeEnum(1, this.kind);
      if (this.bucket !== undefined) writer.writeString(2, this.bucket);
      if (this.documentKey !== undefined) writer.writeString(3, this.documentKey);
      if (this.previous !== undefined) writer.writeString(4, this.previous);
      if (this.current !== undefined) writer.writeString(5, this.current);
      if (!w) return writer.getResultBuffer();
    }
    serializeBinary(): Uint8Array {
      throw new Error("Method not implemented.");
    }
    static deserialize(bytes: Uint8Array | pb_1.BinaryReader): Change {
      const reader = bytes instanceof Uint8Array ? new pb_1.BinaryReader(bytes) : bytes,
        message = new Change();
      while (reader.nextField()) {
        if (reader.isEndGroup()) break;
        switch (reader.getFieldNumber()) {
          case 1:
            message.kind = reader.readEnum();
            break;
          case 2:
            message.bucket = reader.readString();
            break;
          case 3:
            message.documentKey = reader.readString();
            break;
          case 4:
            message.previous = reader.readString();
            break;
          case 5:
            message.current = reader.readString();
            break;
          default:
            reader.skipField();
        }
      }
      return message;
    }
  }
  export namespace Change {
    export enum Kind {
      INSERT = 0,
      UPDATE = 1,
      DELETE = 3
    }
  }

  export var ChangeQueue = {
    pop: {
      path: "/hooks.ChangeAndReviewQueue/pop",
      requestStream: false,
      responseStream: false,
      requestType: hooks.Pop,
      responseType: hooks.Change,
      requestSerialize: (message: Pop) => Buffer.from(message.serialize()),
      requestDeserialize: (bytes: Buffer) => Pop.deserialize(new Uint8Array(bytes)),
      responseSerialize: (message: Change) => Buffer.from(message.serialize()),
      responseDeserialize: (bytes: Buffer) => Change.deserialize(new Uint8Array(bytes))
    }
  };
  export class ChangeQueueClient extends grpc_1.makeGenericClientConstructor(
    ChangeQueue,
    "ChangeQueue",
    {}
  ) {
    constructor(address: string, credentials: grpc_1.ChannelCredentials) {
      super(address, credentials);
    }
  }
}
