import * as Storage from "@spica-devkit/storage";
import {Axios} from "@spica-devkit/internal_common";
import * as BSON from "bson";

function getValueOfFormField(form, field) {
  return form
    .getBuffer()
    .toString()
    .split(form.getBoundary())
    .find(line => line.includes(`name="${field}"`));
}

describe("@spica-devkit/Storage", () => {
  let getSpy: jest.SpyInstance;
  let postSpy: jest.SpyInstance;
  let putSpy: jest.SpyInstance;
  let deleteSpy: jest.SpyInstance;

  const onUploadProgress = () => {};
  const onDownloadProgress = () => {};

  beforeEach(() => {
    getSpy = jest.spyOn(Axios.prototype, "get").mockReturnValue(Promise.resolve());
    postSpy = jest.spyOn(Axios.prototype, "post").mockReturnValue(Promise.resolve([]));
    putSpy = jest.spyOn(Axios.prototype, "put").mockReturnValue(Promise.resolve());
    deleteSpy = jest.spyOn(Axios.prototype, "delete").mockReturnValue(Promise.resolve());

    process.env.__INTERNAL__SPICA__PUBLIC_URL__ = "http://test";
    Storage.initialize({apikey: "TEST_APIKEY"});
  });

  afterEach(() => {
    getSpy.mockClear();
    postSpy.mockClear();
    putSpy.mockClear();
    deleteSpy.mockClear();
  });

  describe("Storage", () => {
    describe("nodejs", () => {
      const storageObject: Storage.BufferWithMeta = {
        contentType: "text/plain",
        name: "my_text.txt",
        data: "spica"
      };

      it("should insert storage object", async () => {
        await Storage.insert(storageObject, onUploadProgress);

        expect(postSpy).toHaveBeenCalledTimes(1);
        const [path, formData, options] = postSpy.mock.calls[0];
        expect(path).toEqual("storage");

        expect(getValueOfFormField(formData, "my_text.txt").includes("spica")).toEqual(true);

        expect((options as any).onUploadProgress).toEqual(onUploadProgress);
        expect((options as any).headers["content-type"].split(";")[0]).toEqual(
          "multipart/form-data"
        );
      });

      it("should insert storage objects", async () => {
        const storageObject2 = {
          contentType: "application/json",
          name: "languages.json",
          data: "{'test':123}"
        };
        await Storage.insertMany([storageObject, storageObject2], onUploadProgress);

        expect(postSpy).toHaveBeenCalledTimes(1);
        const [path, formData, options] = postSpy.mock.calls[0];
        expect(path).toEqual("storage");

        expect(getValueOfFormField(formData, "my_text.txt").includes("spica")).toEqual(true);
        expect(getValueOfFormField(formData, "languages.json").includes("{'test':123}")).toEqual(
          true
        );

        expect((options as any).onUploadProgress).toEqual(onUploadProgress);
        expect((options as any).headers["content-type"].split(";")[0]).toEqual(
          "multipart/form-data"
        );
      });

      it("should update storage object", async () => {
        await Storage.update("storage_object_id", storageObject, onUploadProgress);

        expect(putSpy).toHaveBeenCalledTimes(1);

        const [path, formData, options] = putSpy.mock.calls[0];
        expect(path).toEqual("storage/storage_object_id");

        expect(getValueOfFormField(formData, "my_text.txt").includes("spica")).toEqual(true);

        expect((options as any).onUploadProgress).toEqual(onUploadProgress);
        expect((options as any).headers["content-type"].split(";")[0]).toEqual(
          "multipart/form-data"
        );
      });

      it("should download storage object", () => {
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
    });

    describe("browser", () => {
      beforeEach(() => {
        global.window = {} as any;
      });

      afterEach(() => {
        delete global.window;
      });

      // we can't write tests for insert and update cases on test environment(NodeJS)
      // because we don't have native FormData library(built-in package for browsers)

      it("should download storage object", () => {
        Storage.download("storage_object_id", {
          onDownloadProgress
        });

        expect(getSpy).toHaveBeenCalledTimes(1);
        expect(getSpy).toHaveBeenCalledWith("storage/storage_object_id/view", {
          headers: undefined,
          onDownloadProgress,
          responseType: "blob"
        });
      });
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
  });
});
