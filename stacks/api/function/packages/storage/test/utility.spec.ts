import {instanceOfBase64WithMeta, isValidBase64, prepareBody} from "../src/utility";

describe("Utilities", () => {
  describe("instanceOfBase64WithMeta", () => {
    it("should return true if value instanceof Base64WithMeta", () => {
      const object = {
        data: "c3BpY2E=", // "spica"
        name: "my_file.txt",
        contentType: "text/plain"
      };

      expect(instanceOfBase64WithMeta(object)).toEqual(true);
    });

    it("should return false if value is not instanceof Base64WithMeta", () => {
      const object = {
        unknown_field: "unknown_value"
      };

      expect(instanceOfBase64WithMeta(object)).toEqual(false);
    });
  });

  describe("isValidBase64", () => {
    it("should return true if value has encoded with base64", () => {
      const value = Buffer.from("spica").toString("base64");
      expect(isValidBase64(value)).toEqual(true);
    });

    it("should return false if value has not encoded with base64", () => {
      const value = Buffer.from("spica").toString("ascii");
      expect(isValidBase64(value)).toEqual(false);
    });
  });

  describe("prepareBody", () => {
    it("should prepare body", async () => {
      const object = {
        data: "c3BpY2E=", // "spica"
        name: "my_file.txt",
        contentType: "text/plain"
      };
      const body = await prepareBody(object);
      expect(body).toEqual({
        name: "my_file.txt",
        content: {
          type: "text/plain",
          data: "c3BpY2E=",
          size: 8
        }
      });
    });
    // complete after decide bson or json
    xit("should throw error if data has invalid base64 format", async () => {
      const object = {
        data: "spica",
        name: "my_file.txt",
        contentType: "text/plain"
      };
      expect(()=>{prepareBody(object)}).toThrow(
        "Invalid encoded content. Please ensure that content encoded with base64"
      );
    });
  });
});
