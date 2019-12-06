import * as pb_1 from "google-protobuf";
import * as grpc_1 from "grpc";
export namespace Http {
  export class Header extends pb_1.Message {
    constructor(data?: any[]) {
      super();
      pb_1.Message.initialize(this, data, 0, -1, [], null);
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
      if (this.key) writer.writeString(1, this.key);
      if (this.value) writer.writeString(2, this.value);
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
  export class Param extends pb_1.Message {
    constructor(data?: any[]) {
      super();
      pb_1.Message.initialize(this, data, 0, -1, [], null);
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
      if (this.key) writer.writeString(1, this.key);
      if (this.value) writer.writeString(2, this.value);
      if (!w) return writer.getResultBuffer();
    }
    static deserialize(bytes: Uint8Array | pb_1.BinaryReader): Param {
      const reader = bytes instanceof Uint8Array ? new pb_1.BinaryReader(bytes) : bytes,
        message = new Param();
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
  export class WriteHead extends pb_1.Message {
    constructor(data?: any[]) {
      super();
      pb_1.Message.initialize(this, data, 0, -1, [4], null);
    }
    get id(): string | undefined {
      return pb_1.Message.getFieldWithDefault(this, 1, undefined) as string | undefined;
    }
    set id(value: string) {
      pb_1.Message.setField(this, 1, value);
    }
    get statusCode(): number | undefined {
      return pb_1.Message.getFieldWithDefault(this, 2, undefined) as number | undefined;
    }
    set statusCode(value: number) {
      pb_1.Message.setField(this, 2, value);
    }
    get statusMessage(): string | undefined {
      return pb_1.Message.getFieldWithDefault(this, 3, undefined) as string | undefined;
    }
    set statusMessage(value: string) {
      pb_1.Message.setField(this, 3, value);
    }
    get headers(): Header[] {
      return pb_1.Message.getRepeatedWrapperField(this, Header, 4) as Header[];
    }
    set headers(value: Header[]) {
      pb_1.Message.setRepeatedWrapperField(this, 4, value);
    }
    toObject() {
      return {
        id: this.id,
        statusCode: this.statusCode,
        statusMessage: this.statusMessage,
        headers: this.headers
      };
    }
    serialize(w?: pb_1.BinaryWriter): Uint8Array | undefined {
      const writer = w || new pb_1.BinaryWriter();
      if (this.id) writer.writeString(1, this.id);
      if (this.statusCode) writer.writeInt32(2, this.statusCode);
      if (this.statusMessage) writer.writeString(3, this.statusMessage);
      if (this.headers)
        writer.writeRepeatedMessage(4, this.headers, (item: Header) => item.serialize(writer));
      if (!w) return writer.getResultBuffer();
    }
    static deserialize(bytes: Uint8Array | pb_1.BinaryReader): WriteHead {
      const reader = bytes instanceof Uint8Array ? new pb_1.BinaryReader(bytes) : bytes,
        message = new WriteHead();
      while (reader.nextField()) {
        if (reader.isEndGroup()) break;
        switch (reader.getFieldNumber()) {
          case 1:
            message.id = reader.readString();
            break;
          case 2:
            message.statusCode = reader.readInt32();
            break;
          case 3:
            message.statusMessage = reader.readString();
            break;
          case 4:
            reader.readMessage(message.headers, () =>
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
  export namespace WriteHead {
    export class Result extends pb_1.Message {
      constructor(data?: any[]) {
        super();
        pb_1.Message.initialize(this, data, 0, -1, [], null);
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
  export class Write extends pb_1.Message {
    constructor(data?: any[]) {
      super();
      pb_1.Message.initialize(this, data, 0, -1, [], null);
    }
    get id(): string | undefined {
      return pb_1.Message.getFieldWithDefault(this, 1, undefined) as string | undefined;
    }
    set id(value: string) {
      pb_1.Message.setField(this, 1, value);
    }
    get data(): Uint8Array | undefined {
      return pb_1.Message.getFieldWithDefault(this, 2, undefined) as Uint8Array | undefined;
    }
    set data(value: Uint8Array) {
      pb_1.Message.setField(this, 2, value);
    }
    get encoding(): string | undefined {
      return pb_1.Message.getFieldWithDefault(this, 3, undefined) as string | undefined;
    }
    set encoding(value: string) {
      pb_1.Message.setField(this, 3, value);
    }
    toObject() {
      return {
        id: this.id,
        data: this.data,
        encoding: this.encoding
      };
    }
    serialize(w?: pb_1.BinaryWriter): Uint8Array | undefined {
      const writer = w || new pb_1.BinaryWriter();
      if (this.id) writer.writeString(1, this.id);
      if (this.data) writer.writeBytes(2, this.data);
      if (this.encoding) writer.writeString(3, this.encoding);
      if (!w) return writer.getResultBuffer();
    }
    static deserialize(bytes: Uint8Array | pb_1.BinaryReader): Write {
      const reader = bytes instanceof Uint8Array ? new pb_1.BinaryReader(bytes) : bytes,
        message = new Write();
      while (reader.nextField()) {
        if (reader.isEndGroup()) break;
        switch (reader.getFieldNumber()) {
          case 1:
            message.id = reader.readString();
            break;
          case 2:
            message.data = reader.readBytes();
            break;
          case 3:
            message.encoding = reader.readString();
            break;
          default:
            reader.skipField();
        }
      }
      return message;
    }
  }
  export namespace Write {
    export class Result extends pb_1.Message {
      constructor(data?: any[]) {
        super();
        pb_1.Message.initialize(this, data, 0, -1, [], null);
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
  export class Request extends pb_1.Message {
    constructor(data?: any[]) {
      super();
      pb_1.Message.initialize(this, data, 0, -1, [7, 8], null);
    }
    get statusCode(): number | undefined {
      return pb_1.Message.getFieldWithDefault(this, 1, undefined) as number | undefined;
    }
    set statusCode(value: number) {
      pb_1.Message.setField(this, 1, value);
    }
    get statusMessage(): string | undefined {
      return pb_1.Message.getFieldWithDefault(this, 2, undefined) as string | undefined;
    }
    set statusMessage(value: string) {
      pb_1.Message.setField(this, 2, value);
    }
    get method(): string | undefined {
      return pb_1.Message.getFieldWithDefault(this, 3, undefined) as string | undefined;
    }
    set method(value: string) {
      pb_1.Message.setField(this, 3, value);
    }
    get url(): string | undefined {
      return pb_1.Message.getFieldWithDefault(this, 4, undefined) as string | undefined;
    }
    set url(value: string) {
      pb_1.Message.setField(this, 4, value);
    }
    get path(): string | undefined {
      return pb_1.Message.getFieldWithDefault(this, 5, undefined) as string | undefined;
    }
    set path(value: string) {
      pb_1.Message.setField(this, 5, value);
    }
    get query(): string | undefined {
      return pb_1.Message.getFieldWithDefault(this, 6, undefined) as string | undefined;
    }
    set query(value: string) {
      pb_1.Message.setField(this, 6, value);
    }
    get headers(): Header[] {
      return pb_1.Message.getRepeatedWrapperField(this, Header, 7) as Header[];
    }
    set headers(value: Header[]) {
      pb_1.Message.setRepeatedWrapperField(this, 7, value);
    }
    get params(): Param[] {
      return pb_1.Message.getRepeatedWrapperField(this, Param, 8) as Param[];
    }
    set params(value: Param[]) {
      pb_1.Message.setRepeatedWrapperField(this, 8, value);
    }
    get body(): Uint8Array | undefined {
      return pb_1.Message.getFieldWithDefault(this, 9, undefined) as Uint8Array | undefined;
    }
    set body(value: Uint8Array) {
      pb_1.Message.setField(this, 9, value);
    }
    toObject() {
      return {
        statusCode: this.statusCode,
        statusMessage: this.statusMessage,
        method: this.method,
        url: this.url,
        path: this.path,
        query: this.query,
        headers: this.headers,
        params: this.params,
        body: this.body
      };
    }
    serialize(w?: pb_1.BinaryWriter): Uint8Array | undefined {
      const writer = w || new pb_1.BinaryWriter();
      if (this.statusCode) writer.writeInt32(1, this.statusCode);
      if (this.statusMessage) writer.writeString(2, this.statusMessage);
      if (this.method) writer.writeString(3, this.method);
      if (this.url) writer.writeString(4, this.url);
      if (this.path) writer.writeString(5, this.path);
      if (this.query) writer.writeString(6, this.query);
      if (this.headers)
        writer.writeRepeatedMessage(7, this.headers, (item: Header) => item.serialize(writer));
      if (this.params)
        writer.writeRepeatedMessage(8, this.params, (item: Param) => item.serialize(writer));
      if (this.body) writer.writeBytes(9, this.body);
      if (!w) return writer.getResultBuffer();
    }
    static deserialize(bytes: Uint8Array | pb_1.BinaryReader): Request {
      const reader = bytes instanceof Uint8Array ? new pb_1.BinaryReader(bytes) : bytes,
        message = new Request();
      while (reader.nextField()) {
        if (reader.isEndGroup()) break;
        switch (reader.getFieldNumber()) {
          case 1:
            message.statusCode = reader.readInt32();
            break;
          case 2:
            message.statusMessage = reader.readString();
            break;
          case 3:
            message.method = reader.readString();
            break;
          case 4:
            message.url = reader.readString();
            break;
          case 5:
            message.path = reader.readString();
            break;
          case 6:
            message.query = reader.readString();
            break;
          case 7:
            reader.readMessage(message.headers, () =>
              pb_1.Message.addToRepeatedWrapperField(message, 7, Header.deserialize(reader), Header)
            );
            break;
          case 8:
            reader.readMessage(message.params, () =>
              pb_1.Message.addToRepeatedWrapperField(message, 8, Param.deserialize(reader), Param)
            );
            break;
          case 9:
            message.body = reader.readBytes();
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
      constructor(data?: any[]) {
        super();
        pb_1.Message.initialize(this, data, 0, -1, [], null);
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
  }
  export class End extends pb_1.Message {
    constructor(data?: any[]) {
      super();
      pb_1.Message.initialize(this, data, 0, -1, [], null);
    }
    get id(): string | undefined {
      return pb_1.Message.getFieldWithDefault(this, 1, undefined) as string | undefined;
    }
    set id(value: string) {
      pb_1.Message.setField(this, 1, value);
    }
    get data(): Uint8Array | undefined {
      return pb_1.Message.getFieldWithDefault(this, 2, undefined) as Uint8Array | undefined;
    }
    set data(value: Uint8Array) {
      pb_1.Message.setField(this, 2, value);
    }
    get encoding(): string | undefined {
      return pb_1.Message.getFieldWithDefault(this, 3, undefined) as string | undefined;
    }
    set encoding(value: string) {
      pb_1.Message.setField(this, 3, value);
    }
    toObject() {
      return {
        id: this.id,
        data: this.data,
        encoding: this.encoding
      };
    }
    serialize(w?: pb_1.BinaryWriter): Uint8Array | undefined {
      const writer = w || new pb_1.BinaryWriter();
      if (this.id) writer.writeString(1, this.id);
      if (this.data) writer.writeBytes(2, this.data);
      if (this.encoding) writer.writeString(3, this.encoding);
      if (!w) return writer.getResultBuffer();
    }
    static deserialize(bytes: Uint8Array | pb_1.BinaryReader): End {
      const reader = bytes instanceof Uint8Array ? new pb_1.BinaryReader(bytes) : bytes,
        message = new End();
      while (reader.nextField()) {
        if (reader.isEndGroup()) break;
        switch (reader.getFieldNumber()) {
          case 1:
            message.id = reader.readString();
            break;
          case 2:
            message.data = reader.readBytes();
            break;
          case 3:
            message.encoding = reader.readString();
            break;
          default:
            reader.skipField();
        }
      }
      return message;
    }
  }
  export namespace End {
    export class Result extends pb_1.Message {
      constructor(data?: any[]) {
        super();
        pb_1.Message.initialize(this, data, 0, -1, [], null);
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
      path: "/Http/Queue/pop",
      requestStream: false,
      responseStream: false,
      requestType: Http.Request.Pop,
      responseType: Http.Request,
      requestSerialize: (message: Request.Pop) => Buffer.from(message.serialize()),
      requestDeserialize: (bytes: Buffer) => Request.Pop.deserialize(new Uint8Array(bytes)),
      responseSerialize: (message: Request) => Buffer.from(message.serialize()),
      responseDeserialize: (bytes: Buffer) => Request.deserialize(new Uint8Array(bytes))
    },
    writeHead: {
      path: "/Http/Queue/writeHead",
      requestStream: false,
      responseStream: false,
      requestType: Http.WriteHead,
      responseType: Http.WriteHead.Result,
      requestSerialize: (message: WriteHead) => Buffer.from(message.serialize()),
      requestDeserialize: (bytes: Buffer) => WriteHead.deserialize(new Uint8Array(bytes)),
      responseSerialize: (message: WriteHead.Result) => Buffer.from(message.serialize()),
      responseDeserialize: (bytes: Buffer) => WriteHead.Result.deserialize(new Uint8Array(bytes))
    },
    write: {
      path: "/Http/Queue/write",
      requestStream: false,
      responseStream: false,
      requestType: Http.Write,
      responseType: Http.Write.Result,
      requestSerialize: (message: Write) => Buffer.from(message.serialize()),
      requestDeserialize: (bytes: Buffer) => Write.deserialize(new Uint8Array(bytes)),
      responseSerialize: (message: Write.Result) => Buffer.from(message.serialize()),
      responseDeserialize: (bytes: Buffer) => Write.Result.deserialize(new Uint8Array(bytes))
    },
    end: {
      path: "/Http/Queue/end",
      requestStream: false,
      responseStream: false,
      requestType: Http.End,
      responseType: Http.End.Result,
      requestSerialize: (message: End) => Buffer.from(message.serialize()),
      requestDeserialize: (bytes: Buffer) => End.deserialize(new Uint8Array(bytes)),
      responseSerialize: (message: End.Result) => Buffer.from(message.serialize()),
      responseDeserialize: (bytes: Buffer) => End.Result.deserialize(new Uint8Array(bytes))
    }
  };
  export const QueueClient = grpc_1.makeGenericClientConstructor(Queue, "Queue", {});
}
