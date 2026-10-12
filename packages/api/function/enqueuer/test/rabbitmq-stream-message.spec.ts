import {serialize} from "../src/rabbitmq/strategies/stream-message";

class AmqpByte {
  constructor(private value: number) {}
  get byteValue() {
    return this.value;
  }
}

describe("rabbitmq stream message serialization", () => {
  it("should tag the values JSON cannot carry", () => {
    const serialized = JSON.parse(
      serialize({
        content: Buffer.from("payload"),
        offset: 9007199254740993n,
        messageProperties: {
          userId: Buffer.from("guest"),
          creationTime: new Date("2026-01-01T00:00:00.000Z")
        },
        messageAnnotations: {"x-priority": new AmqpByte(7) as any, "x-region": "eu"}
      })
    );

    expect(serialized.offset).toEqual({type: "BigInt", value: "9007199254740993"});
    expect(serialized.messageProperties.userId).toEqual({
      type: "Buffer",
      data: [...Buffer.from("guest")]
    });
    expect(serialized.messageProperties.creationTime).toEqual({
      type: "Date",
      value: "2026-01-01T00:00:00.000Z"
    });
    expect(serialized.messageAnnotations).toEqual({
      "x-priority": {type: "AmqpByte", value: 7},
      "x-region": "eu"
    });
  });

  it("should leave the content out", () => {
    const serialized = JSON.parse(serialize({content: Buffer.from("payload"), offset: 1n}));

    expect(serialized.content).toBeUndefined();
  });

  it("should drop undefined values, including nested ones", () => {
    const serialized = JSON.parse(
      serialize({
        content: Buffer.from("payload"),
        messageProperties: {subject: undefined, messageId: "id"},
        amqpValue: undefined
      })
    );

    expect(serialized.messageProperties).toEqual({messageId: "id"});
    expect("amqpValue" in serialized).toBe(false);
  });
});
