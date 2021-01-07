import {prepareBody, fileToBase64} from "../src/utility";

describe("Utilities", () => {
  describe("fileToBase64", () => {
    it("should convert file to base64", async () => {
      const file = Buffer.from("spica")
      const result = await fileToBase64(file as any);
      expect(result).toEqual("c3BpY2E=");
    });
  });
});
