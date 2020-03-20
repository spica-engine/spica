import {testCreateActivity} from "./";
import {testControllerInfo, testActivity} from "./activity.logger";
import {Action} from "./interface";

describe("Create Activity", () => {
  describe("bucket", () => {
    it("should create and return PUT activity", () => {
      const req = {
        params: {
          id: "bucket_id"
        }
      };
      const res = {
        asd: "blablab",
        _id: "bucket_id"
      };
      const givenActivity = {
        resource: undefined,
        identifier: "some identifier",
        action: undefined
      };
      const info: testControllerInfo = {
        action: Action.PUT,
        resource: {moduleName: "BUCKET", documentId: "id"}
      };
      let activity = testCreateActivity(req, res, givenActivity, info);
      expect(activity).toEqual({
        action: Action.PUT,
        identifier: "some identifier",
        resource: {moduleName: "BUCKET", documentId: ["bucket_id"]}
      });
    });
    it("should create and return POST activity", () => {
      const req = {
        params: {}
      };
      const res = {
        asd: "blablab",
        _id: "bucket_id"
      };
      const givenActivity = {
        resource: undefined,
        identifier: "some identifier",
        action: undefined
      };
      const info: testControllerInfo = {
        action: Action.POST,
        resource: {moduleName: "BUCKET", documentId: ""}
      };
      let activity = testCreateActivity(req, res, givenActivity, info);
      expect(activity).toEqual({
        action: Action.POST,
        identifier: "some identifier",
        resource: {moduleName: "BUCKET", documentId: ["bucket_id"]}
      });
    });
  });

  describe("bucket-data", () => {
    it("should put", () => {
      const req = {
        params: {
          bucketId: "bucket_id",
          documentId: "bucket_data_id"
        }
      };
      const res = {
        asd: "blablab",
        _id: "bucket_data_id"
      };
      const givenActivity = {
        resource: undefined,
        identifier: "some identifier",
        action: undefined
      };
      const info: testControllerInfo = {
        action: Action.PUT,
        resource: {moduleName: "BUCKET-DATA", moduleId: "bucketId", documentId: "documentId"}
      };
      let activity = testCreateActivity(req, res, givenActivity, info);
      expect(activity).toEqual({
        action: Action.PUT,
        identifier: "some identifier",
        resource: {moduleName: "BUCKET-DATA", moduleId: "bucket_id", documentId: ["bucket_data_id"]}
      });
    });
    it("should delete", () => {
      const req = {
        params: {
          bucketId: "bucket_id"
        },
        body: {
          _id: "bucket_data_id"
        }
      };
      const res = undefined;
      const givenActivity = {
        resource: undefined,
        identifier: "some identifier",
        action: undefined
      };
      const info: testControllerInfo = {
        action: Action.DELETE,
        resource: {moduleName: "BUCKET-DATA", moduleId: "bucketId", documentId: "_id"}
      };
      let activity = testCreateActivity(req, res, givenActivity, info);
      expect(activity).toEqual({
        action: Action.DELETE,
        identifier: "some identifier",
        resource: {moduleName: "BUCKET-DATA", moduleId: "bucket_id", documentId: ["bucket_data_id"]}
      });
    });

    it("should multi delete", () => {
      const req = {
        params: {
          bucketId: "bucket_id"
        },
        body: [
          {
            _id: "bucket_data_id1"
          },
          {
            _id: "bucket_data_id2"
          }
        ]
      };
      const res = undefined;
      const givenActivity = {
        resource: undefined,
        identifier: "some identifier",
        action: undefined
      };
      const info: testControllerInfo = {
        action: Action.DELETE,
        resource: {moduleName: "BUCKET-DATA", moduleId: "bucketId", documentId: "_id"}
      };
      let activity = testCreateActivity(req, res, givenActivity, info);
      expect(activity).toEqual({
        action: Action.DELETE,
        identifier: "some identifier",
        resource: {
          moduleName: "BUCKET-DATA",
          moduleId: "bucket_id",
          documentId: ["bucket_data_id1", "bucket_data_id2"]
        }
      });
    });
  });
});
