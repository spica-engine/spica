import * as pb_1 from "google-protobuf";
import * as grpc_1 from "@grpc/grpc-js";

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
export class Action extends pb_1.Message {
  constructor(
    data?:
      | any[]
      | {
          type?: Action.Type;
          headers?: Header[];
          bucket?: string;
          document?: string;
        }
  ) {
    super();
    pb_1.Message.initialize(this, Array.isArray(data) && data, 0, -1, [2], null);
    if (!Array.isArray(data) && typeof data == "object") {
      this.type = data.type;
      this.headers = data.headers;
      this.bucket = data.bucket;
      this.document = data.document;
    }
  }
  get type(): Action.Type | undefined {
    return pb_1.Message.getFieldWithDefault(this, 1, undefined) as Action.Type | undefined;
  }
  set type(value: Action.Type) {
    pb_1.Message.setField(this, 1, value);
  }
  get headers(): Header[] {
    return pb_1.Message.getRepeatedWrapperField(this, Header, 2) as Header[];
  }
  set headers(value: Header[]) {
    pb_1.Message.setRepeatedWrapperField(this, 2, value);
  }
  get bucket(): string | undefined {
    return pb_1.Message.getFieldWithDefault(this, 3, undefined) as string | undefined;
  }
  set bucket(value: string) {
    pb_1.Message.setField(this, 3, value);
  }
  get document(): string | undefined {
    return pb_1.Message.getFieldWithDefault(this, 4, undefined) as string | undefined;
  }
  set document(value: string) {
    pb_1.Message.setField(this, 4, value);
  }
  toObject() {
    return {
      type: this.type,
      headers: this.headers.map((item: Header) => item.toObject()),
      bucket: this.bucket,
      document: this.document
    };
  }
  serialize(w?: pb_1.BinaryWriter): Uint8Array | undefined {
    const writer = w || new pb_1.BinaryWriter();
    if (this.type !== undefined) writer.writeEnum(1, this.type);
    if (this.headers !== undefined)
      writer.writeRepeatedMessage(2, this.headers, (item: Header) => item.serialize(writer));
    if (this.bucket !== undefined) writer.writeString(3, this.bucket);
    if (this.document !== undefined) writer.writeString(4, this.document);
    if (!w) return writer.getResultBuffer();
  }

  static deserialize(bytes: Uint8Array | pb_1.BinaryReader): Action {
    const reader = bytes instanceof Uint8Array ? new pb_1.BinaryReader(bytes) : bytes,
      message = new Action();
    while (reader.nextField()) {
      if (reader.isEndGroup()) break;
      switch (reader.getFieldNumber()) {
        case 1:
          message.type = reader.readEnum();
          break;
        case 2:
          reader.readMessage(message.headers, () =>
            pb_1.Message.addToRepeatedWrapperField(message, 2, Header.deserialize(reader), Header)
          );
          break;
        case 3:
          message.bucket = reader.readString();
          break;
        case 4:
          message.document = reader.readString();
          break;
        default:
          reader.skipField();
      }
    }
    return message;
  }
}
export namespace Action {
  export enum Type {
    INSERT = 0,
    UPDATE = 1,
    INDEX = 2,
    GET = 3,
    DELETE = 4
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
export class Result extends pb_1.Message {
  constructor(
    data?:
      | any[]
      | {
          id?: string;
          result?: string;
        }
  ) {
    super();
    pb_1.Message.initialize(this, Array.isArray(data) && data, 0, -1, [], null);
    if (!Array.isArray(data) && typeof data == "object") {
      this.id = data.id;
      this.result = data.result;
    }
  }
  get id(): string | undefined {
    return pb_1.Message.getFieldWithDefault(this, 1, undefined) as string | undefined;
  }
  set id(value: string) {
    pb_1.Message.setField(this, 1, value);
  }
  get result(): string | undefined {
    return pb_1.Message.getFieldWithDefault(this, 2, undefined) as string | undefined;
  }
  set result(value: string) {
    pb_1.Message.setField(this, 2, value);
  }
  toObject() {
    return {
      id: this.id,
      result: this.result
    };
  }
  serialize(w?: pb_1.BinaryWriter): Uint8Array | undefined {
    const writer = w || new pb_1.BinaryWriter();
    if (this.id !== undefined) writer.writeString(1, this.id);
    if (this.result !== undefined) writer.writeString(2, this.result);
    if (!w) return writer.getResultBuffer();
  }

  static deserialize(bytes: Uint8Array | pb_1.BinaryReader): Result {
    const reader = bytes instanceof Uint8Array ? new pb_1.BinaryReader(bytes) : bytes,
      message = new Result();
    while (reader.nextField()) {
      if (reader.isEndGroup()) break;
      switch (reader.getFieldNumber()) {
        case 1:
          message.id = reader.readString();
          break;
        case 2:
          message.result = reader.readString();
          break;
        default:
          reader.skipField();
      }
    }
    return message;
  }
}
export namespace Result {
  export class Response extends pb_1.Message {
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

    static deserialize(bytes: Uint8Array | pb_1.BinaryReader): Response {
      const reader = bytes instanceof Uint8Array ? new pb_1.BinaryReader(bytes) : bytes,
        message = new Response();
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
export var Queue = {
  pop: {
    path: "/Queue/pop",
    requestStream: false,
    responseStream: false,
    requestType: Action.Pop,
    responseType: Action,
    requestSerialize: (message: Action.Pop) => Buffer.from(message.serialize()),
    requestDeserialize: (bytes: Buffer) => Action.Pop.deserialize(new Uint8Array(bytes)),
    responseSerialize: (message: Action) => Buffer.from(message.serialize()),
    responseDeserialize: (bytes: Buffer) => Action.deserialize(new Uint8Array(bytes))
  },
  result: {
    path: "/Queue/result",
    requestStream: false,
    responseStream: false,
    requestType: Result,
    responseType: Result.Response,
    requestSerialize: (message: Result) => Buffer.from(message.serialize()),
    requestDeserialize: (bytes: Buffer) => Result.deserialize(new Uint8Array(bytes)),
    responseSerialize: (message: Result.Response) => Buffer.from(message.serialize()),
    responseDeserialize: (bytes: Buffer) => Result.Response.deserialize(new Uint8Array(bytes))
  }
};
export class QueueClient extends grpc_1.makeGenericClientConstructor(Queue, "Queue", {}) {
  constructor(address: string, credentials: grpc_1.ChannelCredentials) {
    super(address, credentials);
  }
}
