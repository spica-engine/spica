import * as pb_1 from "google-protobuf";
import * as grpc_1 from "grpc";
export namespace Event {
    export class Event extends pb_1.Message {
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
        get type(): Event.Type | undefined {
            return pb_1.Message.getFieldWithDefault(this, 2, undefined) as Event.Type | undefined;
        }
        set type(value: Event.Type) {
            pb_1.Message.setField(this, 2, value);
        }
        get target(): Event.Target | undefined {
            return pb_1.Message.getWrapperField(this, Target, 3) as Event.Target | undefined;
        }
        set target(value: Event.Target) {
            pb_1.Message.setWrapperField(this, 3, value);
        }

        toObject() {
            return {
                id: this.id,
                type: this.type,
                target: this.target && this.target.toObject()
            };
        }

        serialize(w?: pb_1.BinaryWriter): Uint8Array | undefined {
            const writer = w || new pb_1.BinaryWriter();
            if (this.id)
                writer.writeString(1, this.id);
            if (this.type != undefined)
                writer.writeEnum(2, this.type);
            if (this.target != null)
                writer.writeMessage(3, this.target, () => this.target.serialize(writer));

            if ( !w ) { 
                return writer.getResultBuffer();
            }
        }

        static deserialize(bytes: Uint8Array | pb_1.BinaryReader): Event {
            const reader = bytes instanceof Uint8Array ? new pb_1.BinaryReader(bytes) : bytes, 
                  message = new Event();
            while (reader.nextField()) {
                if (reader.isEndGroup()) {
                    break;
                }
                switch (reader.getFieldNumber()) {
                    case 1: 
                        message.id = reader.readString();
                        break;
                    case 2: 
                        message.type = reader.readEnum();
                        break;
                    case 3: 
                        reader.readMessage(null, () => message.target = Target.deserialize(reader));
                        break;
                    default: 
                        reader.skipField();
                        break;
                }
            }
            return message;
        }
    }
    export class Target extends pb_1.Message {
        constructor(data?: any[]) {
            super();
            pb_1.Message.initialize(this, data, 0, -1, [], null);
        }
        get cwd(): string | undefined {
            return pb_1.Message.getFieldWithDefault(this, 1, undefined) as string | undefined;
        }
        set cwd(value: string) {
            pb_1.Message.setField(this, 1, value);
        }
        get handler(): string | undefined {
            return pb_1.Message.getFieldWithDefault(this, 2, undefined) as string | undefined;
        }
        set handler(value: string) {
            pb_1.Message.setField(this, 2, value);
        }

        toObject() {
            return {
                cwd: this.cwd,
                handler: this.handler
            };
        }

        serialize(w?: pb_1.BinaryWriter): Uint8Array | undefined {
            const writer = w || new pb_1.BinaryWriter();
            if (this.cwd)
                writer.writeString(1, this.cwd);
            if (this.handler)
                writer.writeString(2, this.handler);
            
            if ( !w ) {
                return writer.readBuffer();
            }
        }

   

        static deserialize(bytes: Uint8Array | pb_1.BinaryReader): Target {
            const reader = bytes instanceof Uint8Array ? new pb_1.BinaryReader(bytes) : bytes,
                message = new Target();

            while (reader.nextField()) {
                if (reader.isEndGroup()) {
                    break;
                }
                switch (reader.getFieldNumber()) {
                    case 1: 
                        message.cwd = reader.readString();
                        break;
                    case 2: 
                        message.handler = reader.readString();
                        break;
                    default: 
                        reader.skipField();
                        break;
                }
            }
            return message;
        }
    }
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
        serializeBinary(w?: pb_1.BinaryWriter): Uint8Array | undefined {
            const writer = w || new pb_1.BinaryWriter();
            if (this.id)
                writer.writeString(1, this.id);
            if (! w ) {
                return writer.getResultBuffer();
            }
     
        }
        static deserializeBinary(bytes: Uint8Array |  pb_1.BinaryReader): Pop {
            const reader = bytes instanceof Uint8Array ? new pb_1.BinaryReader(bytes) : bytes, message = new Pop();
            while (reader.nextField()) {
                if (reader.isEndGroup()) {
                    break;
                }
                switch (reader.getFieldNumber()) {
                    case 1: message.id = reader.readString();
                    default: reader.skipField();
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
            requestSerialize: (message: Pop) => Buffer.from(message.serializeBinary()),
            requestDeserialize: (bytes: Buffer) => Pop.deserializeBinary(new Uint8Array(bytes)),
            responseSerialize: (message: Event) => Buffer.from(message.serialize()),
            responseDeserialize: (bytes: Buffer) => Event.deserialize(new Uint8Array(bytes))
        }
    };
    export const QueueClient = grpc_1.makeGenericClientConstructor(Queue, "Queue", {});
}
