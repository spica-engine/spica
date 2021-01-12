import * as Storage from "@spica-devkit/storage";
import {http, Parser} from "@spica-devkit/internal_common";
import * as BSON from "bson";
import {jsonToArrayBuffer} from "../src/utility";

jasmine.getEnv().allowRespy(true);

describe("@spica-devkit/Storage", () => {
  let getSpy: jasmine.SpyObj<any>;
  let postSpy: jasmine.SpyObj<any>;
  let putSpy: jasmine.SpyObj<any>;
  let deleteSpy: jasmine.SpyObj<any>;

  beforeEach(() => {
    process.env.__INTERNAL__SPICA__PUBLIC_URL__ = "http://test";
    Storage.initialize({apikey: "TEST_APIKEY"});

    getSpy = spyOn(http, "get").and.returnValue(Promise.resolve());
    postSpy = spyOn(http, "post").and.returnValue(Promise.resolve());
    putSpy = spyOn(http, "put").and.returnValue(Promise.resolve());
    deleteSpy = spyOn(http, "del").and.returnValue(Promise.resolve());
  });

  describe("Storage", () => {
    const storageObject: Storage.BufferWithMeta = {
      contentType: "text/plain",
      name: "my_text.txt",
      data: "spica"
    };

    it("should insert storage object", async () => {
      await Storage.insert(storageObject);

      const body = {
        content: [
          {
            name: "my_text.txt",
            content: {
              type: "text/plain",
              data: new BSON.Binary("spica")
            }
          }
        ]
      };

      expect(postSpy).toHaveBeenCalledTimes(1);
      expect(postSpy).toHaveBeenCalledWith("http://test/storage", {
        headers: {Authorization: "APIKEY TEST_APIKEY", "Content-Type": "application/bson"},
        body: jsonToArrayBuffer(body)
      });
    });

    it("should insert storage objects", async () => {
      await Storage.insertMany([storageObject]);

      const body = {
        content: [
          {
            name: "my_text.txt",
            content: {
              type: "text/plain",
              data: new BSON.Binary("spica")
            }
          }
        ]
      };

      expect(postSpy).toHaveBeenCalledTimes(1);
      expect(postSpy).toHaveBeenCalledWith("http://test/storage", {
        headers: {Authorization: "APIKEY TEST_APIKEY", "Content-Type": "application/bson"},
        body: jsonToArrayBuffer(body)
      });
    });

    it("should update storage object", async () => {
      await Storage.update("storage_object_id", storageObject);

      const body = {
        name: "my_text.txt",
        content: {
          type: "text/plain",
          data: new BSON.Binary("spica")
        }
      };

      expect(putSpy).toHaveBeenCalledTimes(1);
      expect(putSpy).toHaveBeenCalledWith("http://test/storage/storage_object_id", {
        headers: {Authorization: "APIKEY TEST_APIKEY", "Content-Type": "application/bson"},
        body: jsonToArrayBuffer(body)
      });
    });

    it("should delete storage object", () => {
      Storage.remove("storage_object_id");

      expect(deleteSpy).toHaveBeenCalledTimes(1);
      expect(deleteSpy).toHaveBeenCalledWith("http://test/storage/storage_object_id", {
        headers: {Authorization: "APIKEY TEST_APIKEY"}
      });
    });

    it("should get storage objects", () => {
      Storage.getAll();

      expect(getSpy).toHaveBeenCalledTimes(1);
      expect(getSpy).toHaveBeenCalledWith(new URL("http://test/storage"), {
        headers: {Authorization: "APIKEY TEST_APIKEY"}
      });
    });

    it("should get specific storage object", () => {
      Storage.get("storage_object_id");

      expect(getSpy).toHaveBeenCalledTimes(1);
      expect(getSpy).toHaveBeenCalledWith("http://test/storage/storage_object_id", {
        headers: {Authorization: "APIKEY TEST_APIKEY"}
      });
    });

    it("should download storage object", () => {
      Storage.download("storage_object_id");

      expect(getSpy).toHaveBeenCalledTimes(1);
      expect(getSpy).toHaveBeenCalledWith(
        "http://test/storage/storage_object_id/view",
        {
          headers: {Authorization: "APIKEY TEST_APIKEY"}
        },
        Parser.Blob
      );
    });
  });
});
