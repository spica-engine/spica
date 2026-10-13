import {serialize} from "../src/rabbitmq/strategies/stream-message";

describe("rabbitmq stream message serialization", () => {
  it("should carry the offset as a decimal string", () => {
    const serialized = JSON.parse(serialize({content: Buffer.from("payload"), offset: 9007199254740993n}));

    expect(serialized.offset).toBe("9007199254740993");
  });

  it("should serialize the dates as ISO strings and keep the buffers JSON-encoded", () => {
    const serialized = JSON.parse(
      serialize({
        content: Buffer.from("payload"),
        offset: 1n,
        messageProperties: {
          userId: Buffer.from("guest"),
          creationTime: new Date("2026-01-01T00:00:00.000Z")
        }
      })
    );

    expect(serialized.messageProperties.userId).toEqual({
      type: "Buffer",
      data: [...Buffer.from("guest")]
    });
    expect(serialized.messageProperties.creationTime).toBe("2026-01-01T00:00:00.000Z");
  });

  it("should leave the content out", () => {
    const serialized = JSON.parse(serialize({content: Buffer.from("payload"), offset: 1n}));

    expect(serialized.content).toBeUndefined();
  });

  it("should drop undefined values, including nested ones", () => {
    const serialized = JSON.parse(
      serialize({
        content: Buffer.from("payload"),
        offset: 1n,
        messageProperties: {subject: undefined, messageId: "id"},
        amqpValue: undefined
      })
    );

    expect(serialized.messageProperties).toEqual({messageId: "id"});
    expect("amqpValue" in serialized).toBe(false);
  });
});
