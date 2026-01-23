import {Grpc} from "@spica-server/function/queue/proto";

describe("Grpc", () => {
  describe("Request", () => {
    it("should map metadata headers", () => {
      const req = new Grpc.Request();
      const header = new Grpc.Header();
      header.key = "authorization";
      header.value = "Bearer token123";
      req.metadata = [header];

      const r = Grpc.Request.deserialize(req.serialize());
      expect(r.metadata[0].key).toBe("authorization");
      expect(r.metadata[0].value).toBe("Bearer token123");
    });

    it("should set payload as Buffer", () => {
      const req = new Grpc.Request();
      req.payload = Buffer.from(JSON.stringify({test: "data"}));
      expect(req.payload).toBeInstanceOf(Uint8Array);
      expect(JSON.parse(Buffer.from(req.payload).toString())).toEqual({test: "data"});
    });

    it("should set service, method and id", () => {
      const req = new Grpc.Request();
      req.id = "event-123";
      req.service = "UserService";
      req.method = "GetUser";
      expect(req.id).toBe("event-123");
      expect(req.service).toBe("UserService");
      expect(req.method).toBe("GetUser");
    });

    it("should handle empty metadata", () => {
      const req = new Grpc.Request();
      req.metadata = [];
      expect(req.metadata.length).toBe(0);
    });

    it("should serialize and deserialize correctly", () => {
      const req = new Grpc.Request({
        id: "123",
        service: "TestService",
        method: "TestMethod",
        payload: Buffer.from("test payload")
      });

      const header1 = new Grpc.Header();
      header1.key = "key1";
      header1.value = "value1";

      const header2 = new Grpc.Header();
      header2.key = "key2";
      header2.value = "value2";

      req.metadata = [header1, header2];

      const serialized = req.serialize();
      const deserialized = Grpc.Request.deserialize(serialized);

      expect(deserialized.id).toBe("123");
      expect(deserialized.service).toBe("TestService");
      expect(deserialized.method).toBe("TestMethod");
      expect(Buffer.from(deserialized.payload).toString()).toBe("test payload");
      expect(deserialized.metadata[0].key).toBe("key1");
      expect(deserialized.metadata[0].value).toBe("value1");
      expect(deserialized.metadata[1].key).toBe("key2");
      expect(deserialized.metadata[1].value).toBe("value2");
    });
  });
});
