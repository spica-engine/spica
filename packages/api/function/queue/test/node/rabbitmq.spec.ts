import {RabbitMQ} from "@spica-server/function-queue-proto";
import {RabbitMQChannel, RabbitMQMessage, reviveBuffers} from "../../node/src/rabbitmq";

describe("RabbitMQ", () => {
  describe("Message", () => {
    it("should map event", () => {
      const msg = {
        content: Buffer.from("test")
      };
      const rabbitmqMessage = new RabbitMQ.Message(msg);
      const message = new RabbitMQMessage(rabbitmqMessage);

      expect(message.content.toString()).toBe("test");
    });
  });

  describe("Channel", () => {
    const message = {} as any;
    let queue: Record<"ack" | "nack" | "reject" | "ackAll" | "nackAll", jest.Mock>;
    let channel: RabbitMQChannel;

    function sent(method: keyof typeof queue) {
      return queue[method].mock.calls[0][0].toObject();
    }

    beforeEach(() => {
      queue = {
        ack: jest.fn().mockResolvedValue({}),
        nack: jest.fn().mockResolvedValue({}),
        reject: jest.fn().mockResolvedValue({}),
        ackAll: jest.fn().mockResolvedValue({}),
        nackAll: jest.fn().mockResolvedValue({})
      };
      channel = new RabbitMQChannel("event-1", queue as any);
    });

    it("should use the defaults of amqplib", async () => {
      await channel.ack(message);
      await channel.nack(message);
      await channel.reject(message);
      await channel.ackAll();
      await channel.nackAll();

      expect(sent("ack")).toEqual({id: "event-1", allUpTo: false, requeue: false});
      expect(sent("nack")).toEqual({id: "event-1", allUpTo: false, requeue: true});
      expect(sent("reject")).toEqual({id: "event-1", allUpTo: false, requeue: true});
      expect(sent("ackAll")).toEqual({id: "event-1", allUpTo: false, requeue: false});
      expect(sent("nackAll")).toEqual({id: "event-1", allUpTo: false, requeue: true});
    });

    it("should send the given flags", async () => {
      await channel.ack(message, true);
      await channel.nack(message, true, false);
      await channel.reject(message, false);
      await channel.nackAll(false);

      expect(sent("ack")).toEqual({id: "event-1", allUpTo: true, requeue: false});
      expect(sent("nack")).toEqual({id: "event-1", allUpTo: true, requeue: false});
      expect(sent("reject")).toEqual({id: "event-1", allUpTo: false, requeue: false});
      expect(sent("nackAll")).toEqual({id: "event-1", allUpTo: false, requeue: false});
    });

    it("should resolve without a value", async () => {
      await expect(channel.ack(message)).resolves.toBeUndefined();
    });

    it("should reject when the server refuses the settlement", async () => {
      queue.ack.mockRejectedValue(new Error("No unsettled delivery for event event-1."));

      await expect(channel.ack(message)).rejects.toThrow("No unsettled delivery");
    });
  });

  describe("reviveBuffers", () => {
    it("should restore buffers serialized by JSON", () => {
      const source = {headers: {binary: Buffer.from("abc")}, routingKey: "key"};

      const restored = JSON.parse(JSON.stringify(source), reviveBuffers);

      expect(Buffer.isBuffer(restored.headers.binary)).toBe(true);
      expect(restored.headers.binary.toString()).toBe("abc");
      expect(restored.routingKey).toBe("key");
    });

    it("should leave lookalike objects alone", () => {
      const source = {type: "Buffer", data: [1, 2], extra: true};

      expect(JSON.parse(JSON.stringify(source), reviveBuffers)).toEqual(source);
    });
  });
});
