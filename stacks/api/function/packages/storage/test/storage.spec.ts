import * as Storage from "@spica-devkit/storage";
import {Axios} from "@spica-devkit/internal_common";
import * as BSON from "bson";

jasmine.getEnv().allowRespy(true);

describe("@spica-devkit/Storage", () => {
  let getSpy: jasmine.Spy<any>;
  let postSpy: jasmine.Spy<any>;
  let putSpy: jasmine.Spy<any>;
  let deleteSpy: jasmine.Spy<any>;

  const onUploadProgress = () => {};
  const onDownloadProgress = () => {};

  beforeEach(() => {
    getSpy = spyOn(Axios.prototype, "get").and.returnValue(Promise.resolve());
    postSpy = spyOn(Axios.prototype, "post").and.returnValue(Promise.resolve([]));
    putSpy = spyOn(Axios.prototype, "put").and.returnValue(Promise.resolve());
    deleteSpy = spyOn(Axios.prototype, "delete").and.returnValue(Promise.resolve());

    process.env.__INTERNAL__SPICA__PUBLIC_URL__ = "http://test";
    Storage.initialize({apikey: "TEST_APIKEY"});
  });

  describe("Storage", () => {
    const storageObject: Storage.BufferWithMeta = {
      contentType: "text/plain",
      name: "my_text.txt",
      data: "spica"
    };

    it("should insert storage object", async () => {
      await Storage.insert(storageObject, onUploadProgress);

      const body = {
        content: [
          {
            name: "my_text.txt",
            content: {
              data: new BSON.Binary("spica"),
              type: "text/plain"
            }
          }
        ]
      };

      expect(postSpy).toHaveBeenCalledTimes(1);
      // expect(postSpy).toHaveBeenCalledWith("storage", jsonToArrayBuffer(body), {
      //   onUploadProgress: onUploadProgress
      // });
    });

    it("should insert storage objects", async () => {
      await Storage.insertMany([storageObject], onUploadProgress);

      const body = {
        content: [
          {
            name: "my_text.txt",
            content: {
              data: new BSON.Binary("spica"),
              type: "text/plain"
            }
          }
        ]
      };

      expect(postSpy).toHaveBeenCalledTimes(1);
      // expect(postSpy).toHaveBeenCalledWith("storage", jsonToArrayBuffer(body), {
      //   onUploadProgress: onUploadProgress
      // });
    });

    it("should update storage object", async () => {
      await Storage.update("storage_object_id", storageObject, onUploadProgress);

      const body = {
        name: "my_text.txt",
        content: {
          data: new BSON.Binary("spica"),
          type: "text/plain"
        }
      };

      expect(putSpy).toHaveBeenCalledTimes(1);
      // expect(putSpy).toHaveBeenCalledWith("storage/storage_object_id", jsonToArrayBuffer(body), {
      //   onUploadProgress: onUploadProgress
      // });
    });

    it("should delete storage object", () => {
      Storage.remove("storage_object_id");

      expect(deleteSpy).toHaveBeenCalledTimes(1);
      expect(deleteSpy).toHaveBeenCalledWith("storage/storage_object_id");
    });

    it("should get storage objects", () => {
      Storage.getAll();

      expect(getSpy).toHaveBeenCalledTimes(1);
      expect(getSpy).toHaveBeenCalledWith("storage", {params: undefined});
    });

    it("should get specific storage object", () => {
      Storage.get("storage_object_id");

      expect(getSpy).toHaveBeenCalledTimes(1);
      expect(getSpy).toHaveBeenCalledWith("storage/storage_object_id");
    });

    it("should download storage object for nodejs env", () => {
      Storage.download("storage_object_id", {
        onDownloadProgress
      });

      expect(getSpy).toHaveBeenCalledTimes(1);
      expect(getSpy).toHaveBeenCalledWith("storage/storage_object_id/view", {
        headers: undefined,
        onDownloadProgress,
        responseType: "stream"
      });
    });

    it("should download storage object for browser env", () => {
      global.window = {} as any;

      Storage.download("storage_object_id", {
        onDownloadProgress
      });

      expect(getSpy).toHaveBeenCalledTimes(1);
      expect(getSpy).toHaveBeenCalledWith("storage/storage_object_id/view", {
        headers: undefined,
        onDownloadProgress,
        responseType: "blob"
      });

      global.window = undefined;
    });
  });
});
