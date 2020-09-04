import * as pb_1 from "google-protobuf";
import * as grpc_1 from "@grpc/grpc-js";

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
  export class Review extends pb_1.Message {
    constructor(
      data?:
        | any[]
        | {
            type?: Review.Type;
            headers?: Review.Header[];
            bucket?: string;
            documentKey?: string;
          }
    ) {
      super();
      pb_1.Message.initialize(this, Array.isArray(data) && data, 0, -1, [2], null);
      if (!Array.isArray(data) && typeof data == "object") {
        this.type = data.type;
        this.headers = data.headers;
        this.bucket = data.bucket;
        this.documentKey = data.documentKey;
      }
    }
    get type(): Review.Type | undefined {
      return pb_1.Message.getFieldWithDefault(this, 1, undefined) as Review.Type | undefined;
    }
    set type(value: Review.Type) {
      pb_1.Message.setField(this, 1, value);
    }
    get headers(): Review.Header[] {
      return pb_1.Message.getRepeatedWrapperField(this, Review.Header, 2) as Review.Header[];
    }
    set headers(value: Review.Header[]) {
      pb_1.Message.setRepeatedWrapperField(this, 2, value);
    }
    get bucket(): string | undefined {
      return pb_1.Message.getFieldWithDefault(this, 3, undefined) as string | undefined;
    }
    set bucket(value: string) {
      pb_1.Message.setField(this, 3, value);
    }
    get documentKey(): string | undefined {
      return pb_1.Message.getFieldWithDefault(this, 4, undefined) as string | undefined;
    }
    set documentKey(value: string) {
      pb_1.Message.setField(this, 4, value);
    }
    toObject() {
      return {
        type: this.type,
        headers: this.headers.map((item: Review.Header) => item.toObject()),
        bucket: this.bucket,
        documentKey: this.documentKey
      };
    }
    serialize(w?: pb_1.BinaryWriter): Uint8Array | undefined {
      const writer = w || new pb_1.BinaryWriter();
      if (this.type !== undefined) writer.writeEnum(1, this.type);
      if (this.headers !== undefined)
        writer.writeRepeatedMessage(2, this.headers, (item: Review.Header) =>
          item.serialize(writer)
        );
      if (this.bucket !== undefined) writer.writeString(3, this.bucket);
      if (this.documentKey !== undefined) writer.writeString(4, this.documentKey);
      if (!w) return writer.getResultBuffer();
    }
    serializeBinary(): Uint8Array {
      throw new Error("Method not implemented.");
    }
    static deserialize(bytes: Uint8Array | pb_1.BinaryReader): Review {
      const reader = bytes instanceof Uint8Array ? new pb_1.BinaryReader(bytes) : bytes,
        message = new Review();
      while (reader.nextField()) {
        if (reader.isEndGroup()) break;
        switch (reader.getFieldNumber()) {
          case 1:
            message.type = reader.readEnum();
            break;
          case 2:
            reader.readMessage(message.headers, () =>
              pb_1.Message.addToRepeatedWrapperField(
                message,
                2,
                Review.Header.deserialize(reader),
                Review.Header
              )
            );
            break;
          case 3:
            message.bucket = reader.readString();
            break;
          case 4:
            message.documentKey = reader.readString();
            break;
          default:
            reader.skipField();
        }
      }
      return message;
    }
  }
  export namespace Review {
    export enum Type {
      INSERT = 0,
      UPDATE = 1,
      INDEX = 2,
      GET = 3,
      DELETE = 4,
      STREAM = 5
    }
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
      serializeBinary(): Uint8Array {
        throw new Error("Method not implemented.");
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
    export class Result extends pb_1.Message {
      constructor(
        data?:
          | any[]
          | {
              id?: string;
              type?: Review.Type;
              result?: string;
            }
      ) {
        super();
        pb_1.Message.initialize(this, Array.isArray(data) && data, 0, -1, [], null);
        if (!Array.isArray(data) && typeof data == "object") {
          this.id = data.id;
          this.type = data.type;
          this.result = data.result;
        }
      }
      get id(): string | undefined {
        return pb_1.Message.getFieldWithDefault(this, 1, undefined) as string | undefined;
      }
      set id(value: string) {
        pb_1.Message.setField(this, 1, value);
      }
      get type(): Review.Type | undefined {
        return pb_1.Message.getFieldWithDefault(this, 3, undefined) as Review.Type | undefined;
      }
      set type(value: Review.Type) {
        pb_1.Message.setField(this, 3, value);
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
          type: this.type,
          result: this.result
        };
      }
      serialize(w?: pb_1.BinaryWriter): Uint8Array | undefined {
        const writer = w || new pb_1.BinaryWriter();
        if (this.id !== undefined) writer.writeString(1, this.id);
        if (this.type !== undefined) writer.writeEnum(3, this.type);
        if (this.result !== undefined) writer.writeString(2, this.result);
        if (!w) return writer.getResultBuffer();
      }
      serializeBinary(): Uint8Array {
        throw new Error("Method not implemented.");
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
            case 3:
              message.type = reader.readEnum();
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
        serializeBinary(): Uint8Array {
          throw new Error("Method not implemented.");
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
      REPLACE = 2,
      DELETE = 3
    }
  }
  export class ChangeOrReview extends pb_1.Message {
    constructor(
      data?:
        | any[]
        | {
            review?: Review;
            change?: Change;
          }
    ) {
      super();
      pb_1.Message.initialize(this, Array.isArray(data) && data, 0, -1, [], null);
      if (!Array.isArray(data) && typeof data == "object") {
        this.review = data.review;
        this.change = data.change;
      }
    }
    get review(): Review | undefined {
      return pb_1.Message.getWrapperField(this, Review, 1) as Review | undefined;
    }
    set review(value: Review) {
      pb_1.Message.setWrapperField(this, 1, value);
    }
    get change(): Change | undefined {
      return pb_1.Message.getWrapperField(this, Change, 2) as Change | undefined;
    }
    set change(value: Change) {
      pb_1.Message.setWrapperField(this, 2, value);
    }
    toObject() {
      return {
        review: this.review && this.review.toObject(),
        change: this.change && this.change.toObject()
      };
    }
    serialize(w?: pb_1.BinaryWriter): Uint8Array | undefined {
      const writer = w || new pb_1.BinaryWriter();
      if (this.review !== undefined)
        writer.writeMessage(1, this.review, () => this.review.serialize(writer));
      if (this.change !== undefined)
        writer.writeMessage(2, this.change, () => this.change.serialize(writer));
      if (!w) return writer.getResultBuffer();
    }
    serializeBinary(): Uint8Array {
      throw new Error("Method not implemented.");
    }
    static deserialize(bytes: Uint8Array | pb_1.BinaryReader): ChangeOrReview {
      const reader = bytes instanceof Uint8Array ? new pb_1.BinaryReader(bytes) : bytes,
        message = new ChangeOrReview();
      while (reader.nextField()) {
        if (reader.isEndGroup()) break;
        switch (reader.getFieldNumber()) {
          case 1:
            reader.readMessage(message.review, () => (message.review = Review.deserialize(reader)));
            break;
          case 2:
            reader.readMessage(message.change, () => (message.change = Change.deserialize(reader)));
            break;
          default:
            reader.skipField();
        }
      }
      return message;
    }
  }
  export var ChangeAndReviewQueue = {
    pop: {
      path: "/hooks.ChangeAndReviewQueue/pop",
      requestStream: false,
      responseStream: false,
      requestType: hooks.Pop,
      responseType: hooks.ChangeOrReview,
      requestSerialize: (message: Pop) => Buffer.from(message.serialize()),
      requestDeserialize: (bytes: Buffer) => Pop.deserialize(new Uint8Array(bytes)),
      responseSerialize: (message: ChangeOrReview) => Buffer.from(message.serialize()),
      responseDeserialize: (bytes: Buffer) => ChangeOrReview.deserialize(new Uint8Array(bytes))
    },
    result: {
      path: "/hooks.ChangeAndReviewQueue/result",
      requestStream: false,
      responseStream: false,
      requestType: hooks.Review.Result,
      responseType: hooks.Review.Result.Response,
      requestSerialize: (message: Review.Result) => Buffer.from(message.serialize()),
      requestDeserialize: (bytes: Buffer) => Review.Result.deserialize(new Uint8Array(bytes)),
      responseSerialize: (message: Review.Result.Response) => Buffer.from(message.serialize()),
      responseDeserialize: (bytes: Buffer) =>
        Review.Result.Response.deserialize(new Uint8Array(bytes))
    }
  };
  export class ChangeAndReviewQueueClient extends grpc_1.makeGenericClientConstructor(
    ChangeAndReviewQueue,
    "ChangeAndReviewQueue",
    {}
  ) {
    constructor(address: string, credentials: grpc_1.ChannelCredentials) {
      super(address, credentials);
    }
  }
}
