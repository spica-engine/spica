import * as Bucket from "@spica-devkit/bucket";
import * as Operators from "../src/operators";
import * as Fetch from "node-fetch";
import {of} from "rxjs";

jasmine.getEnv().allowRespy(true);

describe("@spica-devkit/bucket", () => {
  let fetchSpy: jasmine.SpyObj<any>;
  let wsSpy: jasmine.SpyObj<any>;
  let consoleSpy: jasmine.SpyObj<any>;

  beforeEach(() => {
    consoleSpy = spyOn(console, "warn").and.returnValue();

    process.env.__INTERNAL__SPICA__PUBLIC_URL__ = "http://test";
    Bucket.initialize({apikey: "TEST_APIKEY"});
    fetchSpy = spyOn(Fetch, "default").and.returnValue(
      new Promise(resolve =>
        resolve({
          headers: {
            get: () => {}
          },
          json: () => {}
        } as any)
      )
    );

    wsSpy = spyOn(Operators, "getWsObs").and.returnValue(of());
  });

  describe("errors", () => {
    it("should throw error when public url parameter and internal public url are missing", async () => {
      delete process.env.__INTERNAL__SPICA__PUBLIC_URL__;
      expect(() => Bucket.initialize({apikey: "TEST_APIKEY"})).toThrowError(
        "The <__INTERNAL__SPICA__PUBLIC_URL__> variable and public url was not given. "
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
          options: {position: "left", visible: true}
        },
        surname: {
          type: "string",
          title: "surname",
          options: {position: "right"}
        }
      }
    };

    it("should set public url from given parameter", () => {
      Bucket.initialize({apikey: "TEST_APIKEY", publicUrl: "given_public_url"});
      Bucket.getAll();

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(fetchSpy).toHaveBeenCalledWith("given_public_url/bucket", {
        method: "get",
        headers: {
          Authorization: "APIKEY TEST_APIKEY"
        }
      });
    });

    it("should insert bucket", () => {
      Bucket.insert(bucket);

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(fetchSpy).toHaveBeenCalledWith("http://test/bucket", {
        method: "post",
        body: JSON.stringify(bucket),
        headers: {
          Authorization: "APIKEY TEST_APIKEY",
          "Content-Type": "application/json"
        }
      });
    });

    it("should update bucket", () => {
      Bucket.update("bucket_id", {...bucket, title: "new title"});

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(fetchSpy).toHaveBeenCalledWith("http://test/bucket/bucket_id", {
        method: "put",
        body: JSON.stringify({...bucket, title: "new title"}),
        headers: {
          Authorization: "APIKEY TEST_APIKEY",
          "Content-Type": "application/json"
        }
      });
    });

    it("should get all buckets", () => {
      Bucket.getAll();

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(fetchSpy).toHaveBeenCalledWith("http://test/bucket", {
        method: "get",
        headers: {
          Authorization: "APIKEY TEST_APIKEY"
        }
      });
    });

    it("should get specific bucket", () => {
      Bucket.get("bucket_id");

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(fetchSpy).toHaveBeenCalledWith(`http://test/bucket/bucket_id`, {
        method: "get",
        headers: {
          Authorization: "APIKEY TEST_APIKEY"
        }
      });
    });

    it("should remove bucket", () => {
      Bucket.remove("bucket_id");

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(fetchSpy).toHaveBeenCalledWith(`http://test/bucket/bucket_id`, {
        method: "delete",
        headers: {
          Authorization: "APIKEY TEST_APIKEY"
        }
      });
    });

    it("should show warning", async () => {
      fetchSpy = spyOn(Fetch, "default").and.returnValue(
        new Promise(resolve =>
          resolve({
            headers: {
              get: (key: string) => {
                if (key == "warning") {
                  return "deprecation warning";
                }
              }
            },
            json: () => {}
          } as any)
        )
      );

      await Bucket.getAll();

      expect(consoleSpy).toHaveBeenCalledTimes(1);
      expect(consoleSpy).toHaveBeenCalledWith("deprecation warning");
    });
  });

  describe("bucket-data", () => {
    const document: Bucket.BucketDocument = {
      name: "name",
      surname: "surname"
    };

    it("should insert bucket-data", () => {
      Bucket.data.insert("bucket_id", document);

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(fetchSpy).toHaveBeenCalledWith("http://test/bucket/bucket_id/data", {
        method: "post",
        body: JSON.stringify(document),
        headers: {
          Authorization: "APIKEY TEST_APIKEY",
          "Content-Type": "application/json"
        }
      });
    });

    it("should update bucket-data", () => {
      Bucket.data.update("bucket_id", "document_id", document);

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(fetchSpy).toHaveBeenCalledWith("http://test/bucket/bucket_id/data/document_id", {
        method: "put",
        body: JSON.stringify(document),
        headers: {
          Authorization: "APIKEY TEST_APIKEY",
          "Content-Type": "application/json"
        }
      });
    });

    it("should get bucket-data", () => {
      Bucket.data.get("bucket_id", "document_id");

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(fetchSpy).toHaveBeenCalledWith(
        new URL("http://test/bucket/bucket_id/data/document_id"),
        {
          method: "get",
          headers: {
            Authorization: "APIKEY TEST_APIKEY"
          }
        }
      );
    });

    it("should get bucket-data with params", () => {
      Bucket.data.get("bucket_id", "document_id", {
        headers: {"accept-language": "TR"},
        queryParams: {relation: true}
      });

      const url = new URL("http://test/bucket/bucket_id/data/document_id");

      url.searchParams.append("relation", "true");

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(fetchSpy).toHaveBeenCalledWith(url, {
        method: "get",
        headers: {
          "accept-language": "TR",
          Authorization: "APIKEY TEST_APIKEY"
        }
      });
    });

    it("should get all bucket-data", () => {
      Bucket.data.getAll("bucket_id");

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(fetchSpy).toHaveBeenCalledWith(new URL("http://test/bucket/bucket_id/data"), {
        method: "get",
        headers: {
          Authorization: "APIKEY TEST_APIKEY"
        }
      });
    });

    it("should get all bucket-data with params", () => {
      Bucket.data.getAll("bucket_id", {
        headers: {"accept-language": "TR"},
        queryParams: {limit: 1, skip: 2}
      });

      const url = new URL("http://test/bucket/bucket_id/data");

      url.searchParams.append("limit", "1");
      url.searchParams.append("skip", "2");

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(fetchSpy).toHaveBeenCalledWith(url, {
        method: "get",
        headers: {
          "accept-language": "TR",
          Authorization: "APIKEY TEST_APIKEY"
        }
      });
    });
  });

  describe("bucket-data realtime", () => {
    describe("getAll", () => {
      it("should get all bucket-data", () => {
        Bucket.data.realtime.getAll("bucket_id");

        expect(wsSpy).toHaveBeenCalledTimes(1);
        expect(wsSpy).toHaveBeenCalledWith(
          "ws://test/bucket/bucket_id/data?Authorization=APIKEY TEST_APIKEY",
          undefined
        );
      });

      it("should get all with filter", () => {
        Bucket.data.realtime.getAll("bucket_id", {
          filter: "name=='test'"
        });

        expect(wsSpy).toHaveBeenCalledTimes(1);
        expect(wsSpy).toHaveBeenCalledWith(
          `ws://test/bucket/bucket_id/data?Authorization=APIKEY TEST_APIKEY&filter=name=='test'`,
          undefined
        );
      });

      it("should get all with sort", () => {
        Bucket.data.realtime.getAll("bucket_id", {
          sort: {
            age: 1
          }
        });

        expect(wsSpy).toHaveBeenCalledTimes(1);
        expect(wsSpy).toHaveBeenCalledWith(
          'ws://test/bucket/bucket_id/data?Authorization=APIKEY TEST_APIKEY&sort={"age":1}',
          {
            age: 1
          }
        );
      });

      it("should get all with limit and skip", () => {
        Bucket.data.realtime.getAll("bucket_id", {
          limit: 1,
          skip: 1
        });

        expect(wsSpy).toHaveBeenCalledTimes(1);
        expect(wsSpy).toHaveBeenCalledWith(
          "ws://test/bucket/bucket_id/data?Authorization=APIKEY TEST_APIKEY&limit=1&skip=1",
          undefined
        );
      });
    });

    describe("get", () => {
      it("should get specific bucket-data", () => {
        Bucket.data.realtime.get("bucket_id", "document_id");

        expect(wsSpy).toHaveBeenCalledTimes(1);
        expect(wsSpy).toHaveBeenCalledWith(
          'ws://test/bucket/bucket_id/data?Authorization=APIKEY TEST_APIKEY&filter=_id=="document_id"'
        );
      });
    });
  });
});
