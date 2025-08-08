import {RabbitMQ} from "../../proto";
import {RabbitMQMessage} from "../../node/src/rabbitmq";

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
});
