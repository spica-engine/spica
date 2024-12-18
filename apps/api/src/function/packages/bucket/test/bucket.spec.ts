import * as Bucket from "@spica-devkit/bucket";
import * as Operators from "@spica-devkit/bucket/src/operators";
import {Axios} from "@spica-devkit/internal_common";
import {of} from "rxjs";

jasmine.getEnv().allowRespy(true);

describe("@spica-devkit/bucket", () => {
  let getSpy: jest.Mocked<any>;
  let postSpy: jest.Mocked<any>;
  let putSpy: jest.Mocked<any>;
  let deleteSpy: jest.Mocked<any>;
  let wsSpy: jest.Mocked<any>;

  beforeEach(() => {
    getSpy = jest.spyOn(Axios.prototype, "get").mockReturnValue(Promise.resolve());
    postSpy = jest.spyOn(Axios.prototype, "post").mockReturnValue(Promise.resolve());
    putSpy = jest.spyOn(Axios.prototype, "put").mockReturnValue(Promise.resolve());
    deleteSpy = jest.spyOn(Axios.prototype, "delete").mockReturnValue(Promise.resolve());

    process.env.__INTERNAL__SPICA__PUBLIC_URL__ = "http://test";
    Bucket.initialize({apikey: "TEST_APIKEY"});

    wsSpy = jest.spyOn(Operators, "getWsObs").mockReturnValue(of() as any);
  });

  describe("errors", () => {
    it("should throw error when public url parameter and internal public url are missing", async () => {
      delete process.env.__INTERNAL__SPICA__PUBLIC_URL__;
      expect(() => Bucket.initialize({apikey: "TEST_APIKEY"})).toThrowError(
        "Public url must be provided."
      );
    });
  });

  describe("bucket", () => {
    const bucket: Bucket.Bucket = {
      title: "User Bucket",
      description: "User Bucket Description",
      primary: "name",
      properties: {
        name: {
          type: "string",
          title: "name",
          options: {position: "left"}
        },
        surname: {
          type: "string",
          title: "surname",
          options: {position: "right"}
        }
      }
    };

    it("should insert bucket", () => {
      Bucket.insert(bucket);

      expect(postSpy).toHaveBeenCalledTimes(1);
      expect(postSpy).toHaveBeenCalledWith("bucket", bucket);
    });

    it("should update bucket", () => {
      const updatedBucket = {...bucket, title: "new title"};
      Bucket.update("bucket_id", updatedBucket);

      expect(putSpy).toHaveBeenCalledTimes(1);
      expect(putSpy).toHaveBeenCalledWith("bucket/bucket_id", updatedBucket);
    });

    it("should get all buckets", () => {
      Bucket.getAll();

      expect(getSpy).toHaveBeenCalledTimes(1);
      expect(getSpy).toHaveBeenCalledWith("bucket");
    });

    it("should get specific bucket", () => {
      Bucket.get("bucket_id");

      expect(getSpy).toHaveBeenCalledTimes(1);
      expect(getSpy).toHaveBeenCalledWith("bucket/bucket_id");
    });

    it("should remove bucket", () => {
      Bucket.remove("bucket_id");

      expect(deleteSpy).toHaveBeenCalledTimes(1);
      expect(deleteSpy).toHaveBeenCalledWith("bucket/bucket_id");
    });

    describe("bucket-data", () => {
      const document: Bucket.BucketDocument = {
        name: "name",
        surname: "surname"
      };

      it("should insert bucket-data", () => {
        Bucket.data.insert("bucket_id", document);

        expect(postSpy).toHaveBeenCalledTimes(1);
        expect(postSpy).toHaveBeenCalledWith("bucket/bucket_id/data", document);
      });

      it("should update bucket-data", () => {
        Bucket.data.update("bucket_id", "document_id", document);

        expect(putSpy).toHaveBeenCalledTimes(1);
        expect(putSpy).toHaveBeenCalledWith("bucket/bucket_id/data/document_id", document);
      });

      it("should get bucket-data", () => {
        Bucket.data.get("bucket_id", "document_id");

        expect(getSpy).toHaveBeenCalledTimes(1);
        expect(getSpy).toHaveBeenCalledWith("bucket/bucket_id/data/document_id", {
          params: undefined,
          headers: undefined
        });
      });

      it("should get bucket-data with params", () => {
        Bucket.data.get("bucket_id", "document_id", {
          headers: {"accept-language": "TR"},
          queryParams: {relation: true}
        });

        expect(getSpy).toHaveBeenCalledTimes(1);
        expect(getSpy).toHaveBeenCalledWith("bucket/bucket_id/data/document_id", {
          headers: {"accept-language": "TR"},
          params: {relation: true}
        });
      });

      it("should get all bucket-data", () => {
        Bucket.data.getAll("bucket_id");

        expect(getSpy).toHaveBeenCalledTimes(1);
        expect(getSpy).toHaveBeenCalledWith("bucket/bucket_id/data", {
          params: undefined,
          headers: undefined
        });
      });

      it("should get all bucket-data with params", () => {
        Bucket.data.getAll("bucket_id", {
          headers: {"accept-language": "TR"},
          queryParams: {limit: 1, skip: 2}
        });

        expect(getSpy).toHaveBeenCalledTimes(1);
        expect(getSpy).toHaveBeenCalledWith("bucket/bucket_id/data", {
          headers: {
            "accept-language": "TR"
          },
          params: {
            limit: 1,
            skip: 2
          }
        });
      });
    });

    describe("bucket-data realtime", () => {
      describe("getAll", () => {
        it("should get all bucket-data", () => {
          Bucket.data.realtime.getAll("bucket_id");

          const url = new URL("ws://test/bucket/bucket_id/data");
          url.searchParams.append("Authorization", "APIKEY TEST_APIKEY");

          expect(wsSpy).toHaveBeenCalledTimes(1);
          expect(wsSpy).toHaveBeenCalledWith(url.toString(), undefined, undefined, undefined);
        });

        it("should get all with filter", () => {
          Bucket.data.realtime.getAll("bucket_id", {
            filter: "name=='test'"
          });

          const url = new URL("ws://test/bucket/bucket_id/data");
          url.searchParams.append("filter", "name=='test'");
          url.searchParams.append("Authorization", "APIKEY TEST_APIKEY");

          expect(wsSpy).toHaveBeenCalledTimes(1);
          expect(wsSpy).toHaveBeenCalledWith(url.toString(), undefined, undefined, undefined);
        });

        it("should get all with sort", () => {
          const sort = {age: 1};

          Bucket.data.realtime.getAll("bucket_id", {
            sort
          });

          const url = new URL("ws://test/bucket/bucket_id/data");
          url.searchParams.append("sort", JSON.stringify(sort));
          url.searchParams.append("Authorization", "APIKEY TEST_APIKEY");

          expect(wsSpy).toHaveBeenCalledTimes(1);
          expect(wsSpy).toHaveBeenCalledWith(url.toString(), sort, undefined, undefined);
        });

        it("should get all with limit and skip", () => {
          Bucket.data.realtime.getAll("bucket_id", {
            limit: 1,
            skip: 1
          });

          const url = new URL("ws://test/bucket/bucket_id/data");
          url.searchParams.append("limit", "1");
          url.searchParams.append("skip", "1");
          url.searchParams.append("Authorization", "APIKEY TEST_APIKEY");

          expect(wsSpy).toHaveBeenCalledTimes(1);
          expect(wsSpy).toHaveBeenCalledWith(url.toString(), undefined, undefined, undefined);
        });
      });

      describe("get", () => {
        it("should get specific bucket-data", () => {
          Bucket.data.realtime.get("bucket_id", "document_id");

          const url = new URL("ws://test/bucket/bucket_id/data");
          url.searchParams.append("filter", 'document._id=="document_id"');
          url.searchParams.append("Authorization", "APIKEY TEST_APIKEY");

          expect(wsSpy).toHaveBeenCalledTimes(1);
          expect(wsSpy).toHaveBeenCalledWith(url.toString(), undefined, "document_id", undefined);
        });
      });
    });
  });
});
