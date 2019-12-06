import * as pb_2 from "google-protobuf";
import * as grpc_1 from "grpc";
export namespace Event {
  export class Event extends pb_2.Message {
    constructor(data?: any[]) {
      super();
      pb_2.Message.initialize(this, data, 0, -1, [], null);
    }
    get id(): string | undefined {
      return pb_2.Message.getFieldWithDefault(this, 1, undefined) as string | undefined;
    }
    set id(value: string) {
      pb_2.Message.setField(this, 1, value);
    }
    get type(): Type | undefined {
      return pb_2.Message.getFieldWithDefault(this, 2, undefined) as Type | undefined;
    }
    set type(value: Type) {
      pb_2.Message.setField(this, 2, value);
    }
    get target(): Target | undefined {
      return pb_2.Message.getWrapperField(this, Target, 3) as Target | undefined;
    }
    set target(value: Target) {
      pb_2.Message.setWrapperField(this, 3, value);
    }
    toObject() {
      return {
        id: this.id,
        type: this.type,
        target: this.target
      };
    }
    serialize(w?: pb_2.BinaryWriter): Uint8Array | undefined {
      const writer = w || new pb_2.BinaryWriter();
      if (this.id) writer.writeString(1, this.id);
      if (this.type != undefined) writer.writeEnum(2, this.type);
      if (this.target != null)
        writer.writeMessage(3, this.target, () => this.target.serialize(writer));
      if (!w) return writer.getResultBuffer();
    }
    static deserialize(bytes: Uint8Array | pb_2.BinaryReader): Event {
      const reader = bytes instanceof Uint8Array ? new pb_2.BinaryReader(bytes) : bytes,
        message = new Event();
      while (reader.nextField()) {
        if (reader.isEndGroup()) break;
        switch (reader.getFieldNumber()) {
          case 1:
            message.id = reader.readString();
            break;
          case 2:
            message.type = reader.readEnum();
            break;
          case 3:
            reader.readMessage(
              message.target,
              (_, reader: pb_2.BinaryReader) => (message.target = Target.deserialize(reader))
            );
            break;
          default:
            reader.skipField();
        }
      }
      return message;
    }
  }
  export class Target extends pb_2.Message {
    constructor(data?: any[]) {
      super();
      pb_2.Message.initialize(this, data, 0, -1, [], null);
    }
    get cwd(): string | undefined {
      return pb_2.Message.getFieldWithDefault(this, 1, undefined) as string | undefined;
    }
    set cwd(value: string) {
      pb_2.Message.setField(this, 1, value);
    }
    get handler(): string | undefined {
      return pb_2.Message.getFieldWithDefault(this, 2, undefined) as string | undefined;
    }
    set handler(value: string) {
      pb_2.Message.setField(this, 2, value);
    }
    toObject() {
      return {
        cwd: this.cwd,
        handler: this.handler
      };
    }
    serialize(w?: pb_2.BinaryWriter): Uint8Array | undefined {
      const writer = w || new pb_2.BinaryWriter();
      if (this.cwd) writer.writeString(1, this.cwd);
      if (this.handler) writer.writeString(2, this.handler);
      if (!w) return writer.getResultBuffer();
    }
    static deserialize(bytes: Uint8Array | pb_2.BinaryReader): Target {
      const reader = bytes instanceof Uint8Array ? new pb_2.BinaryReader(bytes) : bytes,
        message = new Target();
      while (reader.nextField()) {
        if (reader.isEndGroup()) break;
        switch (reader.getFieldNumber()) {
          case 1:
            message.cwd = reader.readString();
            break;
          case 2:
            message.handler = reader.readString();
            break;
          default:
            reader.skipField();
        }
      }
      return message;
    }
  }
  export class Pop extends pb_2.Message {
    constructor(data?: any[]) {
      super();
      pb_2.Message.initialize(this, data, 0, -1, [], null);
    }
    get id(): string | undefined {
      return pb_2.Message.getFieldWithDefault(this, 1, undefined) as string | undefined;
    }
    set id(value: string) {
      pb_2.Message.setField(this, 1, value);
    }
    toObject() {
      return {
        id: this.id
      };
    }
    serialize(w?: pb_2.BinaryWriter): Uint8Array | undefined {
      const writer = w || new pb_2.BinaryWriter();
      if (this.id) writer.writeString(1, this.id);
      if (!w) return writer.getResultBuffer();
    }
    static deserialize(bytes: Uint8Array | pb_2.BinaryReader): Pop {
      const reader = bytes instanceof Uint8Array ? new pb_2.BinaryReader(bytes) : bytes,
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
  export enum Type {
    HTTP = 0,
    DATABASE = 1,
    SCHEDULE = 3,
    FIREHOSE = 4
  }
  export const Queue = {
    pop: {
      path: "/Queue/pop",
      requestStream: false,
      responseStream: false,
      requestType: Pop,
      responseType: Event,
      requestSerialize: (message: Pop) => Buffer.from(message.serialize()),
      requestDeserialize: (bytes: Buffer) => Pop.deserialize(new Uint8Array(bytes)),
      responseSerialize: (message: Event) => Buffer.from(message.serialize()),
      responseDeserialize: (bytes: Buffer) => Event.deserialize(new Uint8Array(bytes))
    }
  };
  export const QueueClient = grpc_1.makeGenericClientConstructor(Queue, "Queue", {});
}
