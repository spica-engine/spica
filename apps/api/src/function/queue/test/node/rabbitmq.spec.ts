import {RabbitMQ} from "@spica-server/function/queue/proto";
import {RabbitMQMessage} from "../../node/src/rabbitmq";

describe("RabbitMQ", () => {
  describe("Message", () => {
    it("should map INSERT event", () => {
      const rabbitmqMessage = new RabbitMQ.RabbitMQMessage();
      rabbitmqMessage.msg = "Test Message!";
      const message = new RabbitMQMessage(rabbitmqMessage);

      expect(message.msg).toBe(rabbitmqMessage.msg);
    });
  });
});
