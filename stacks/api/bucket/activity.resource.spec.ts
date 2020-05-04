import {Action} from "@spica-server/activity/services";
import {createBucketDataResource, createBucketResource} from "./activity.resource";

describe("Activity Resource", () => {
  describe("bucket", () => {
    it("should return activity from post request", () => {
      const res = {
        _id: "bucket_id"
      };
      const action = Action.POST;

      const resource = createBucketResource(action, {}, res);
      expect(resource).toEqual(["bucket","bucket_id"]);
    });

    it("should return activity from put request", () => {
      const req = {
        params: {
          id: "bucket_id"
        }
      };
      const action = Action.PUT;

      const resource = createBucketResource(action, req, {});
      expect(resource).toEqual(["bucket","bucket_id"]);
    });

    it("should return activity from delete request", () => {
      const req = {
        params: {
          id: "bucket_id"
        }
      };
      const action = Action.DELETE;

      const resource = createBucketResource(action, req, {});
      expect(resource).toEqual(["bucket","bucket_id"]);
    });
  });
  describe("bucket-data", () => {
    // it("should return activity from post request", () => {
    //   const req = {
    //     params: {
    //       bucketId: "bucket_id"
    //     }
    //   };
    //   const res = {
    //     _id: "bucket_data_id"
    //   };
    //   const action = Action.POST;

    //   const resource = createBucketDataResource(action, req, res);
    //   expect(resource).toEqual({
    //     name: "Bucket_bucket_id",
    //     documentId: ["bucket_data_id"]
    //   });
    // });

    // it("should return activity from put request", () => {
    //   const req = {
    //     params: {
    //       bucketId: "bucket_id",
    //       documentId: "bucket_data_id"
    //     }
    //   };

    //   const action = Action.PUT;
    //   const resource = createBucketDataResource(action, req, {});
    //   expect(resource).toEqual({
    //     name: "Bucket_bucket_id",
    //     documentId: ["bucket_data_id"]
    //   });
    // });

    // it("should return activity from single delete request", () => {
    //   const req = {
    //     params: {
    //       bucketId: "bucket_id",
    //       documentId: "bucket_data_id"
    //     }
    //   };
    //   const action = Action.DELETE;

    //   const resource = createBucketDataResource(action, req, {});
    //   expect(resource).toEqual({
    //     name: "Bucket_bucket_id",
    //     documentId: ["bucket_data_id"]
    //   });
    // });

    // it("should return activity from multiple delete request", () => {
    //   const req = {
    //     params: {
    //       bucketId: "bucket_id"
    //     },
    //     body: ["bucket_data_1", "bucket_data_2"]
    //   };
    //   const action = Action.DELETE;

    //   const resource = createBucketDataResource(action, req, {});
    //   expect(resource).toEqual({
    //     name: "Bucket_bucket_id",
    //     documentId: ["bucket_data_1", "bucket_data_2"]
    //   });
    // });
  });
});
