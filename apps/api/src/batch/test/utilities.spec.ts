import {getBaseUrl, handleResponse, splitIntoChunks} from "../src/utilities";
import {BatchOptions, HTTPResponse, Request} from "../src/interface";

describe("Utilities", () => {
  describe("handleResponse", () => {
    it("should return response from request/response", () => {
      const request: Request = {
        id: "5",
        body: undefined,
        headers: undefined,
        method: "GET",
        url: "test"
      };

      const repsonse: HTTPResponse = {
        status: 200,
        headers: {
          Authorization: "123"
        },
        body: {
          hello: "it's me"
        }
      };

      expect(handleResponse(request, repsonse)).toEqual({
        id: "5",
        status: 200,
        headers: {
          Authorization: "123"
        },
        body: {
          hello: "it's me"
        }
      });
    });
  });

  describe("splitIntoChunks", () => {
    it("should split array into 1 element chnuks", () => {
      const arr = [1, 2];
      const limit = 1;
      const chunks = splitIntoChunks(arr, 1);
      expect(chunks).toEqual([[1], [2]]);
    });

    it("should split array into 2 element chunks", () => {
      const arr = [1, 2, 3, 4, 5, 6];
      const limit = 2;
      const chunks = splitIntoChunks(arr, limit);
      expect(chunks).toEqual([
        [1, 2],
        [3, 4],
        [5, 6]
      ]);
    });

    it("should split array into uneven chunks", () => {
      const arr = [1, 2, 3, 4, 5];
      const limit = 4;
      const chunks = splitIntoChunks(arr, limit);
      expect(chunks).toEqual([[1, 2, 3, 4], [5]]);
    });

    it("should split array into itself", () => {
      const arr = [1, 2];
      const limit = 0;
      const chunks = splitIntoChunks(arr, limit);
      expect(chunks).toEqual([[1, 2]]);
    });
  });

  describe("getBaseUrl", () => {
    it("should get base url", () => {
      const req = {
        protocol: "http"
      };
      const options: BatchOptions = {
        port: "4300"
      };
      const baseUrl = getBaseUrl(req, options);
      expect(baseUrl).toEqual("http://localhost:4300");
    });
  });
});
