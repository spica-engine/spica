import * as Storage from "@spica-devkit/storage";
import {Axios} from "@spica-devkit/internal_common";
import * as BSON from "bson";

jasmine.getEnv().allowRespy(true);

function getValueOfFormField(form, field) {
  return form
    .getBuffer()
    .toString()
    .split(form.getBoundary())
    .find(line => line.includes(`name="${field}"`));
}

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
    

    describe("nodejs", () => {
      const storageObject: Storage.BufferWithMeta = {
        contentType: "text/plain",
        name: "my_text.txt",
        data: "spica"
      };

      
      it("should insert storage object", async () => {
        await Storage.insert(storageObject, onUploadProgress);

        expect(postSpy).toHaveBeenCalledTimes(1);
        const [path, formData, options] = postSpy.calls.allArgs()[0];
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
        }
        await Storage.insertMany([storageObject,storageObject2], onUploadProgress);

        expect(postSpy).toHaveBeenCalledTimes(1);
        const [path, formData, options] = postSpy.calls.allArgs()[0];
        expect(path).toEqual("storage");

        expect(getValueOfFormField(formData, "my_text.txt").includes("spica")).toEqual(true);
        expect(getValueOfFormField(formData, "languages.json").includes("{'test':123}")).toEqual(true);


        expect((options as any).onUploadProgress).toEqual(onUploadProgress);
        expect((options as any).headers["content-type"].split(";")[0]).toEqual(
          "multipart/form-data"
        );
      });

      it("should update storage object", async () => {
        await Storage.update("storage_object_id", storageObject, onUploadProgress);

        expect(putSpy).toHaveBeenCalledTimes(1);

        const [path, formData, options] = putSpy.calls.allArgs()[0];
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

      // we can't write tests for insert and update caseson test environment(NodeJS)
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
