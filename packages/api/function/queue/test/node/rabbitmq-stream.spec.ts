import {RabbitMQ} from "@spica-server/function-queue-proto";
import {RabbitMQMessage, rabbitmqArguments, RabbitMQChannel} from "../../node/src/rabbitmq";
import {deserialize, RabbitMQStreamConsumer} from "../../node/src/rabbitmq/runtimes/stream";

function streamMessage(wire: Record<string, unknown>, consumer = "token") {
  return new RabbitMQMessage(
    new RabbitMQ.Message({
      mode: "stream",
      content: Buffer.from("payload"),
      stream: JSON.stringify(wire),
      consumer
    })
  );
}

describe("RabbitMQ stream runtime", () => {
  describe("deserialization", () => {
    it("should restore the offset and the buffers of the message of the client", () => {
      const message = deserialize(
        streamMessage({
          offset: "9007199254740993",
          messageProperties: {
            contentType: "application/json",
            userId: {type: "Buffer", data: [103, 117, 101, 115, 116]},
            creationTime: "2026-01-01T00:00:00.000Z"
          },
          messageHeader: {durable: true, deliveryCount: 2},
          applicationProperties: {tenant: "eu", retries: 3},
          messageAnnotations: {"x-region": "eu"},
          amqpValue: "value"
        })
      );

      expect(message.offset).toBe(9007199254740993n);
      expect(message.content).toEqual(Buffer.from("payload"));
      expect(message.messageProperties.contentType).toBe("application/json");
      expect(message.messageProperties.userId).toEqual(Buffer.from("guest"));
      expect(message.messageProperties.creationTime).toBe("2026-01-01T00:00:00.000Z");
      expect(message.messageHeader).toEqual({durable: true, deliveryCount: 2});
      expect(message.applicationProperties).toEqual({tenant: "eu", retries: 3});
      expect(message.messageAnnotations).toEqual({"x-region": "eu"});
      expect(message.amqpValue).toBe("value");
    });

    it("should keep the content of the message as a buffer", () => {
      const message = deserialize(streamMessage({offset: "1"}));

      expect(Buffer.isBuffer(message.content)).toBe(true);
    });
  });

  describe("runtime", () => {
    it("should return the message and the consumer for the stream mode", () => {
      const [message, consumer] = rabbitmqArguments(
        "event-1",
        streamMessage({offset: "3"}),
        {} as any
      );

      expect((message as any).offset).toBe(3n);
      expect(Buffer.isBuffer((message as any).content)).toBe(true);
      expect(consumer).toBeInstanceOf(RabbitMQStreamConsumer);
      expect(consumer).not.toBeInstanceOf(RabbitMQChannel);
    });
  });

  describe("consumer", () => {
    let client: {invoke: jest.Mock};

    beforeEach(() => {
      client = {invoke: jest.fn().mockResolvedValue(new RabbitMQ.Message.Result())};
    });

    it("should store the offset of the message by default", async () => {
      await new RabbitMQStreamConsumer("token", 12n, client as any).storeOffset();

      const [method, request] = client.invoke.mock.calls[0];
      expect(method).toBe("storeOffset");
      expect(request.toObject()).toEqual({consumer: "token", offset: "12"});
    });

    it("should store the given offset", async () => {
      await new RabbitMQStreamConsumer("token", 12n, client as any).storeOffset(20n);

      expect(client.invoke.mock.calls[0][1].toObject()).toEqual({consumer: "token", offset: "20"});
    });
  });
});
