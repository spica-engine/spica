import * as Bucket from "@spica-devkit/bucket";
import {Axios} from "@spica-devkit/internal_common";

describe("@spica-devkit/bucket", () => {
  let getSpy: jest.Mocked<any>;
  let postSpy: jest.Mocked<any>;
  let putSpy: jest.Mocked<any>;
  let patchSpy: jest.Mocked<any>;
  let deleteSpy: jest.Mocked<any>;

  beforeEach(() => {
    getSpy = jest.spyOn(Axios.prototype, "get").mockReturnValue(Promise.resolve());
    postSpy = jest.spyOn(Axios.prototype, "post").mockReturnValue(Promise.resolve({responses: []}));
    putSpy = jest.spyOn(Axios.prototype, "put").mockReturnValue(Promise.resolve());
    patchSpy = jest.spyOn(Axios.prototype, "patch").mockReturnValue(Promise.resolve());
    deleteSpy = jest.spyOn(Axios.prototype, "delete").mockReturnValue(Promise.resolve());

    process.env.__INTERNAL__SPICA__PUBLIC_URL__ = "http://test";
    Bucket.initialize({apikey: "TEST_APIKEY"});
  });

  afterEach(() => {
    getSpy.mockClear();
    postSpy.mockClear();
    putSpy.mockClear();
    patchSpy.mockClear();
    deleteSpy.mockClear();
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

    const bucket2: Bucket.Bucket = {
      title: "Address Bucket",
      description: "Address Bucket Description",
      primary: "street",
      properties: {
        street: {
          type: "string",
          title: "street",
          options: {position: "left"}
        },
        city: {
          type: "string",
          title: "city",
          options: {position: "right"}
        }
      }
    };

    it("should insert bucket", () => {
      Bucket.insert(bucket);

      expect(postSpy).toHaveBeenCalledTimes(1);
      expect(postSpy).toHaveBeenCalledWith("bucket", bucket, {headers: undefined});
    });

    it("should insert multiple buckets", () => {
      Bucket.insertMany([bucket, bucket2]);

      expect(postSpy).toHaveBeenCalledTimes(1);
      expect(postSpy).toHaveBeenCalledWith(
        "batch",
        {
          requests: [
            {
              body: bucket,
              headers: {
                Authorization: "APIKEY TEST_APIKEY"
              },
              id: "0",
              method: "POST",
              url: "bucket"
            },
            {
              body: bucket2,
              headers: {
                Authorization: "APIKEY TEST_APIKEY"
              },
              id: "1",
              method: "POST",
              url: "bucket"
            }
          ]
        },
        {headers: undefined}
      );
    });

    it("should insert bucket with headers", () => {
      Bucket.insert(bucket, {Accept: "application/json"});

      expect(postSpy).toHaveBeenCalledTimes(1);
      expect(postSpy).toHaveBeenCalledWith("bucket", bucket, {
        headers: {Accept: "application/json"}
      });
    });

    it("should update bucket", () => {
      const updatedBucket = {...bucket, title: "new title"};
      Bucket.update("bucket_id", updatedBucket);

      expect(putSpy).toHaveBeenCalledTimes(1);
      expect(putSpy).toHaveBeenCalledWith("bucket/bucket_id", updatedBucket, {headers: undefined});
    });

    it("should update bucket with headers", () => {
      const updatedBucket = {...bucket, title: "new title"};
      Bucket.update("bucket_id", updatedBucket, {Accept: "application/json"});

      expect(putSpy).toHaveBeenCalledTimes(1);
      expect(putSpy).toHaveBeenCalledWith("bucket/bucket_id", updatedBucket, {
        headers: {Accept: "application/json"}
      });
    });

    it("should get all buckets", () => {
      Bucket.getAll();

      expect(getSpy).toHaveBeenCalledTimes(1);
      expect(getSpy).toHaveBeenCalledWith("bucket", {headers: undefined});
    });

    it("should get all buckets with headers", () => {
      Bucket.getAll({Accept: "application/json"});

      expect(getSpy).toHaveBeenCalledTimes(1);
      expect(getSpy).toHaveBeenCalledWith("bucket", {headers: {Accept: "application/json"}});
    });

    it("should get specific bucket", () => {
      Bucket.get("bucket_id");

      expect(getSpy).toHaveBeenCalledTimes(1);
      expect(getSpy).toHaveBeenCalledWith("bucket/bucket_id", {headers: undefined});
    });

    it("should get specific bucket with headers", () => {
      Bucket.get("bucket_id", {Accept: "application/json"});

      expect(getSpy).toHaveBeenCalledTimes(1);
      expect(getSpy).toHaveBeenCalledWith("bucket/bucket_id", {
        headers: {Accept: "application/json"}
      });
    });

    it("should remove bucket", () => {
      Bucket.remove("bucket_id");

      expect(deleteSpy).toHaveBeenCalledTimes(1);
      expect(deleteSpy).toHaveBeenCalledWith("bucket/bucket_id", {headers: undefined});
    });

    it("should remove multiple buckets", () => {
      Bucket.removeMany(["bucket_id_1", "bucket_id_2"]);

      expect(postSpy).toHaveBeenCalledTimes(1);
      expect(postSpy).toHaveBeenCalledWith(
        "batch",
        {
          requests: [
            {
              body: undefined,
              headers: {
                Authorization: "APIKEY TEST_APIKEY"
              },
              id: "0",
              method: "DELETE",
              url: "bucket/bucket_id_1"
            },
            {
              body: undefined,
              headers: {
                Authorization: "APIKEY TEST_APIKEY"
              },
              id: "1",
              method: "DELETE",
              url: "bucket/bucket_id_2"
            }
          ]
        },
        {headers: undefined}
      );
    });

    it("should remove bucket with headers", () => {
      Bucket.remove("bucket_id", {Accept: "application/json"});

      expect(deleteSpy).toHaveBeenCalledTimes(1);
      expect(deleteSpy).toHaveBeenCalledWith("bucket/bucket_id", {
        headers: {Accept: "application/json"}
      });
    });

    describe("bucket-data", () => {
      const document: Bucket.BucketDocument = {
        name: "name",
        surname: "surname"
      };

      const document2: Bucket.BucketDocument = {
        name: "micheal",
        surname: "smith"
      };

      it("should insert bucket-data", () => {
        Bucket.data.insert("bucket_id", document);

        expect(postSpy).toHaveBeenCalledTimes(1);
        expect(postSpy).toHaveBeenCalledWith("bucket/bucket_id/data", document, {
          headers: undefined
        });
      });

      it("should insert multiple bucket data", () => {
        Bucket.data.insertMany("bucket_id", [document, document2]);

        expect(postSpy).toHaveBeenCalledTimes(1);
        expect(postSpy).toHaveBeenCalledWith(
          "batch",
          {
            requests: [
              {
                body: document,
                headers: {
                  Authorization: "APIKEY TEST_APIKEY"
                },
                id: "0",
                method: "POST",
                url: "bucket/bucket_id/data"
              },
              {
                body: document2,
                headers: {
                  Authorization: "APIKEY TEST_APIKEY"
                },
                id: "1",
                method: "POST",
                url: "bucket/bucket_id/data"
              }
            ]
          },
          {headers: undefined}
        );
      });

      it("should insert bucket-data with headers", () => {
        Bucket.data.insert("bucket_id", document, {Accept: "application/json"});

        expect(postSpy).toHaveBeenCalledTimes(1);
        expect(postSpy).toHaveBeenCalledWith("bucket/bucket_id/data", document, {
          headers: {Accept: "application/json"}
        });
      });

      it("should update bucket-data", () => {
        Bucket.data.update("bucket_id", "document_id", document);

        expect(putSpy).toHaveBeenCalledTimes(1);
        expect(putSpy).toHaveBeenCalledWith("bucket/bucket_id/data/document_id", document, {
          headers: undefined
        });
      });

      it("should update bucket-data with headers", () => {
        Bucket.data.update("bucket_id", "document_id", document, {Accept: "application/json"});

        expect(putSpy).toHaveBeenCalledTimes(1);
        expect(putSpy).toHaveBeenCalledWith("bucket/bucket_id/data/document_id", document, {
          headers: {Accept: "application/json"}
        });
      });

      it("should patch bucket-data", () => {
        Bucket.data.patch("bucket_id", "document_id", document);

        expect(patchSpy).toHaveBeenCalledTimes(1);
        expect(patchSpy).toHaveBeenCalledWith("bucket/bucket_id/data/document_id", document, {
          headers: undefined
        });
      });

      it("should patch bucket-data with headers", () => {
        Bucket.data.patch("bucket_id", "document_id", document, {Accept: "application/json"});

        expect(patchSpy).toHaveBeenCalledTimes(1);
        expect(patchSpy).toHaveBeenCalledWith("bucket/bucket_id/data/document_id", document, {
          headers: {Accept: "application/json"}
        });
      });

      it("should remove bucket-data", () => {
        Bucket.data.remove("bucket_id", "document_id");

        expect(deleteSpy).toHaveBeenCalledTimes(1);
        expect(deleteSpy).toHaveBeenCalledWith("bucket/bucket_id/data/document_id", {
          headers: undefined
        });
      });

      it("should remove multiple bucket data", () => {
        Bucket.data.removeMany("bucket_id", ["bucket_id_1", "bucket_id_2"]);

        expect(postSpy).toHaveBeenCalledTimes(1);
        expect(postSpy).toHaveBeenCalledWith(
          "batch",
          {
            requests: [
              {
                body: undefined,
                headers: {
                  Authorization: "APIKEY TEST_APIKEY"
                },
                id: "0",
                method: "DELETE",
                url: "bucket/bucket_id/data/bucket_id_1"
              },
              {
                body: undefined,
                headers: {
                  Authorization: "APIKEY TEST_APIKEY"
                },
                id: "1",
                method: "DELETE",
                url: "bucket/bucket_id/data/bucket_id_2"
              }
            ]
          },
          {headers: undefined}
        );
      });

      it("should remove bucket-data with headers", () => {
        Bucket.data.remove("bucket_id", "document_id", {Accept: "application/json"});

        expect(deleteSpy).toHaveBeenCalledTimes(1);
        expect(deleteSpy).toHaveBeenCalledWith("bucket/bucket_id/data/document_id", {
          headers: {Accept: "application/json"}
        });
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
          const connection = Bucket.data.realtime.getAll("bucket_id");

          const url = new URL("ws://test/bucket/bucket_id/data");
          url.searchParams.append("Authorization", "APIKEY TEST_APIKEY");

          expect(connection["_config"].url).toEqual(url.toString());
        });

        it("should get all with filter", () => {
          const connection = Bucket.data.realtime.getAll("bucket_id", {
            filter: "name=='test'"
          });

          const url = new URL("ws://test/bucket/bucket_id/data");
          url.searchParams.append("filter", "name=='test'");
          url.searchParams.append("Authorization", "APIKEY TEST_APIKEY");

          expect(connection["_config"].url).toEqual(url.toString());
        });

        it("should get all with sort", () => {
          const sort = {age: 1};

          const connection = Bucket.data.realtime.getAll("bucket_id", {
            sort
          });

          const url = new URL("ws://test/bucket/bucket_id/data");
          url.searchParams.append("sort", JSON.stringify(sort));
          url.searchParams.append("Authorization", "APIKEY TEST_APIKEY");

          expect(connection["_config"].url).toEqual(url.toString());
        });

        it("should get all with limit and skip", () => {
          const connection = Bucket.data.realtime.getAll("bucket_id", {
            limit: 1,
            skip: 1
          });

          const url = new URL("ws://test/bucket/bucket_id/data");
          url.searchParams.append("limit", "1");
          url.searchParams.append("skip", "1");
          url.searchParams.append("Authorization", "APIKEY TEST_APIKEY");

          expect(connection["_config"].url).toEqual(url.toString());
        });
      });

      describe("get", () => {
        it("should get specific bucket-data", () => {
          const connection = Bucket.data.realtime.get("bucket_id", "document_id");

          const url = new URL("ws://test/bucket/bucket_id/data");
          url.searchParams.append("filter", 'document._id=="document_id"');
          url.searchParams.append("Authorization", "APIKEY TEST_APIKEY");

          expect(connection["_config"].url).toEqual(url.toString());
        });
      });
    });
  });
});
