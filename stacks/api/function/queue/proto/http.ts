import * as pb_2 from "google-protobuf";
import * as grpc_1 from "grpc";
export namespace Http {
    export class Header extends pb_2.Message {
        constructor(data?: any[]) {
            super();
            pb_2.Message.initialize(this, data, 0, -1, [], null);
        }
        get key(): string | undefined {
            return pb_2.Message.getFieldWithDefault(this, 1, undefined) as string | undefined;
        }
        set key(value: string) {
            pb_2.Message.setField(this, 1, value);
        }
        get value(): string | undefined {
            return pb_2.Message.getFieldWithDefault(this, 2, undefined) as string | undefined;
        }
        set value(value: string) {
            pb_2.Message.setField(this, 2, value);
        }
        toObject() {
            return {
                key: this.key,
                value: this.value
            };
        }
        serialize(w?: pb_2.BinaryWriter): Uint8Array | undefined {
            const writer = w || new pb_2.BinaryWriter();
            if (this.key)
                writer.writeString(1, this.key);
            if (this.value)
                writer.writeString(2, this.value);
            if (!w)
                return writer.getResultBuffer();
        }
        static deserialize(bytes: Uint8Array | pb_2.BinaryReader): Header {
            const reader = bytes instanceof Uint8Array ? new pb_2.BinaryReader(bytes) : bytes, message = new Header();
            while (reader.nextField()) {
                if (reader.isEndGroup())
                    break;
                switch (reader.getFieldNumber()) {
                    case 1:
                        message.key = reader.readString();
                        break;
                    case 2:
                        message.value = reader.readString();
                        break;
                    default: reader.skipField();
                }
            }
            return message;
        }
    }
    export class WriteHead extends pb_2.Message {
        constructor(data?: any[]) {
            super();
            pb_2.Message.initialize(this, data, 0, -1, [4], null);
        }
        get id(): string | undefined {
            return pb_2.Message.getFieldWithDefault(this, 1, undefined) as string | undefined;
        }
        set id(value: string) {
            pb_2.Message.setField(this, 1, value);
        }
        get statusCode(): number | undefined {
            return pb_2.Message.getFieldWithDefault(this, 2, undefined) as number | undefined;
        }
        set statusCode(value: number) {
            pb_2.Message.setField(this, 2, value);
        }
        get statusMessage(): string | undefined {
            return pb_2.Message.getFieldWithDefault(this, 3, undefined) as string | undefined;
        }
        set statusMessage(value: string) {
            pb_2.Message.setField(this, 3, value);
        }
        get headers(): Header[] {
            return pb_2.Message.getRepeatedWrapperField(this, Header, 4) as Header[];
        }
        set headers(value: Header[]) {
            pb_2.Message.setRepeatedWrapperField(this, 4, value);
        }
        toObject() {
            return {
                id: this.id,
                statusCode: this.statusCode,
                statusMessage: this.statusMessage,
                headers: this.headers
            };
        }
        serialize(w?: pb_2.BinaryWriter): Uint8Array | undefined {
            const writer = w || new pb_2.BinaryWriter();
            if (this.id)
                writer.writeString(1, this.id);
            if (this.statusCode)
                writer.writeInt32(2, this.statusCode);
            if (this.statusMessage)
                writer.writeString(3, this.statusMessage);
            if (this.headers)
                writer.writeRepeatedMessage(4, this.headers, () => { });
            if (!w)
                return writer.getResultBuffer();
        }
        static deserialize(bytes: Uint8Array | pb_2.BinaryReader): WriteHead {
            const reader = bytes instanceof Uint8Array ? new pb_2.BinaryReader(bytes) : bytes, message = new WriteHead();
            while (reader.nextField()) {
                if (reader.isEndGroup())
                    break;
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
                        reader.readMessage(message.headers, () => pb_2.Message.addToRepeatedField(message, 4, Header.deserialize(reader)));
                        break;
                    default: reader.skipField();
                }
            }
            return message;
        }
    }
    export namespace WriteHead {
        export class Result extends pb_2.Message {
            constructor(data?: any[]) {
                super();
                pb_2.Message.initialize(this, data, 0, -1, [], null);
            }
            toObject() {
                return {};
            }
            serialize(w?: pb_2.BinaryWriter): Uint8Array | undefined {
                const writer = w || new pb_2.BinaryWriter();
                if (!w)
                    return writer.getResultBuffer();
            }
            static deserialize(bytes: Uint8Array | pb_2.BinaryReader): Result {
                const reader = bytes instanceof Uint8Array ? new pb_2.BinaryReader(bytes) : bytes, message = new Result();
                while (reader.nextField()) {
                    if (reader.isEndGroup())
                        break;
                    switch (reader.getFieldNumber()) {
                        default: reader.skipField();
                    }
                }
                return message;
            }
        }
    }
    export class Write extends pb_2.Message {
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
        get data(): Uint8Array | undefined {
            return pb_2.Message.getFieldWithDefault(this, 2, undefined) as Uint8Array | undefined;
        }
        set data(value: Uint8Array) {
            pb_2.Message.setField(this, 2, value);
        }
        toObject() {
            return {
                id: this.id,
                data: this.data
            };
        }
        serialize(w?: pb_2.BinaryWriter): Uint8Array | undefined {
            const writer = w || new pb_2.BinaryWriter();
            if (this.id)
                writer.writeString(1, this.id);
            if (this.data)
                writer.writeBytes(2, this.data);
            if (!w)
                return writer.getResultBuffer();
        }
        static deserialize(bytes: Uint8Array | pb_2.BinaryReader): Write {
            const reader = bytes instanceof Uint8Array ? new pb_2.BinaryReader(bytes) : bytes, message = new Write();
            while (reader.nextField()) {
                if (reader.isEndGroup())
                    break;
                switch (reader.getFieldNumber()) {
                    case 1:
                        message.id = reader.readString();
                        break;
                    case 2:
                        message.data = reader.readBytes();
                        break;
                    default: reader.skipField();
                }
            }
            return message;
        }
    }
    export namespace Write {
        export class Result extends pb_2.Message {
            constructor(data?: any[]) {
                super();
                pb_2.Message.initialize(this, data, 0, -1, [], null);
            }
            toObject() {
                return {};
            }
            serialize(w?: pb_2.BinaryWriter): Uint8Array | undefined {
                const writer = w || new pb_2.BinaryWriter();
                if (!w)
                    return writer.getResultBuffer();
            }
            static deserialize(bytes: Uint8Array | pb_2.BinaryReader): Result {
                const reader = bytes instanceof Uint8Array ? new pb_2.BinaryReader(bytes) : bytes, message = new Result();
                while (reader.nextField()) {
                    if (reader.isEndGroup())
                        break;
                    switch (reader.getFieldNumber()) {
                        default: reader.skipField();
                    }
                }
                return message;
            }
        }
    }
    export class Request extends pb_2.Message {
        constructor(data?: any[]) {
            super();
            pb_2.Message.initialize(this, data, 0, -1, [1], null);
        }
        get headers(): Header[] {
            return pb_2.Message.getRepeatedWrapperField(this, Header, 1) as Header[];
        }
        set headers(value: Header[]) {
            pb_2.Message.setRepeatedWrapperField(this, 1, value);
        }
        toObject() {
            return {
                headers: this.headers
            };
        }
        serialize(w?: pb_2.BinaryWriter): Uint8Array | undefined {
            const writer = w || new pb_2.BinaryWriter();
            if (this.headers)
                writer.writeRepeatedMessage(1, this.headers, () => { });
            if (!w)
                return writer.getResultBuffer();
        }
        static deserialize(bytes: Uint8Array | pb_2.BinaryReader): Request {
            const reader = bytes instanceof Uint8Array ? new pb_2.BinaryReader(bytes) : bytes, message = new Request();
            while (reader.nextField()) {
                if (reader.isEndGroup())
                    break;
                switch (reader.getFieldNumber()) {
                    case 1:
                        reader.readMessage(message.headers, () => pb_2.Message.addToRepeatedField(message, 1, Header.deserialize(reader)));
                        break;
                    default: reader.skipField();
                }
            }
            return message;
        }
    }
    export namespace Request {
        export class Pop extends pb_2.Message {
            constructor(data?: any[]) {
                super();
                pb_2.Message.initialize(this, data, 0, -1, [], null);
            }
            toObject() {
                return {};
            }
            serialize(w?: pb_2.BinaryWriter): Uint8Array | undefined {
                const writer = w || new pb_2.BinaryWriter();
                if (!w)
                    return writer.getResultBuffer();
            }
            static deserialize(bytes: Uint8Array | pb_2.BinaryReader): Pop {
                const reader = bytes instanceof Uint8Array ? new pb_2.BinaryReader(bytes) : bytes, message = new Pop();
                while (reader.nextField()) {
                    if (reader.isEndGroup())
                        break;
                    switch (reader.getFieldNumber()) {
                        default: reader.skipField();
                    }
                }
                return message;
            }
        }
    }
    export const Queue = {
        pop: {
            path: "/Queue/pop",
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
            path: "/Queue/writeHead",
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
            path: "/Queue/write",
            requestStream: false,
            responseStream: false,
            requestType: Http.Write,
            responseType: Http.Write.Result,
            requestSerialize: (message: Write) => Buffer.from(message.serialize()),
            requestDeserialize: (bytes: Buffer) => Write.deserialize(new Uint8Array(bytes)),
            responseSerialize: (message: Write.Result) => Buffer.from(message.serialize()),
            responseDeserialize: (bytes: Buffer) => Write.Result.deserialize(new Uint8Array(bytes))
        }
    };
    export const QueueClient = grpc_1.makeGenericClientConstructor(Queue, "Queue", {});
}
