import {FirehosePool, FirehoseSocket, Message} from "@spica-server/function/queue/node";
import {Firehose} from "@spica-server/function/queue/proto";

describe("Firehose", () => {
  describe("Message", () => {
    it("should map name and data", () => {
      const rawData = new Firehose.Message({
        name: "test",
        data: JSON.stringify("test")
      });
      const data = new Message(rawData);
      expect(data.name).toBe("test");
      expect(data.data).toBe("test");
    });

    it("should not map data if it is empty", () => {
      const rawData = new Firehose.Message({
        name: "test1"
      });
      const data = new Message(rawData);
      expect(data.name).toBe(rawData.name);
      expect(data.data).not.toBeTruthy();
    });
  });

  describe("FirehoseSocket", () => {
    it("should map remoteAddress and id", () => {
      const clDescription = new Firehose.ClientDescription({
        id: "1",
        remoteAddress: "[::1]"
      });

      const socket = new FirehoseSocket(clDescription, undefined, undefined);
      expect(socket.id).toBe(clDescription.id);
      expect(socket.remoteAddress).toBe(clDescription.remoteAddress);
    });

    it("should serialize the data and forward", () => {
      const sendSpy = jasmine.createSpy("send");
      const socket = new FirehoseSocket(new Firehose.ClientDescription(), undefined, sendSpy);
      socket.send("test", {});
      expect(sendSpy).toHaveBeenCalledTimes(1);
      const [lastCallArgument] = sendSpy.calls.argsFor(0);
      expect(lastCallArgument.name).toBe("test");
      expect(lastCallArgument.data).toBe("{}");
    });

    it("should call close", () => {
      const closeSpy = jasmine.createSpy("close");
      const socket = new FirehoseSocket(new Firehose.ClientDescription(), closeSpy, undefined);
      socket.close();
      expect(closeSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("FirehosePool", () => {
    it("should map size", () => {
      const fpDescription = new Firehose.PoolDescription({
        size: 2
      });

      const pool = new FirehosePool(fpDescription, undefined);
      expect(pool.size).toBe(2);
    });

    it("should send message", () => {
      const sendSpy = jasmine.createSpy("send");
      const pool = new FirehosePool(new Firehose.PoolDescription(), sendSpy);
      pool.send("test", {});
      expect(sendSpy).toHaveBeenCalledTimes(1);
      const [lastCallArgument] = sendSpy.calls.argsFor(0);
      expect(lastCallArgument.name).toBe("test");
      expect(lastCallArgument.data).toBe("{}");
    });
  });
});
