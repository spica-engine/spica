import {Action, ControllerDetails, createActivity} from "../";

describe("Create Activity", () => {
  describe("INSERT", () => {
    it("should single data", () => {
      const res = {
        some_field: "some value",
        _id: "inserted_id"
      };
      const req = {
        user: {
          identifier: "spica"
        },
        method: "POST"
      };
      const controllerDetails: ControllerDetails = {
        moduleName: "TEST",
        documentIdKey: "_id"
      };
      let activity = createActivity(req, res, controllerDetails);
      expect(activity).toEqual({
        action: Action.POST,
        identifier: "spica",
        resource: {moduleName: "TEST", documentId: ["inserted_id"]}
      });
    });
    it("multi data", () => {
      const res = [
        {
          some_field: "some value",
          _id: "inserted_id"
        },
        {
          some_field: "some value2",
          _id: "inserted_id2"
        }
      ];
      const req = {
        user: {
          identifier: "spica"
        },
        method: "POST"
      };
      const controllerDetails: ControllerDetails = {
        moduleName: "TEST",
        documentIdKey: "_id"
      };
      let activity = createActivity(req, res, controllerDetails);
      expect(activity).toEqual({
        action: Action.POST,
        identifier: "spica",
        resource: {moduleName: "TEST", documentId: ["inserted_id", "inserted_id2"]}
      });
    });
  });
  describe("UPDATE", () => {
    it("single data from request.params", () => {
      const req = {
        params: {
          id: "updated_document_id"
        },
        user: {
          identifier: "spica"
        },
        method: "PUT"
      };
      const controllerDetails: ControllerDetails = {
        moduleName: "TEST",
        documentIdKey: "id"
      };
      let activity = createActivity(req, {}, controllerDetails);
      expect(activity).toEqual({
        action: Action.PUT,
        identifier: "spica",
        resource: {moduleName: "TEST", documentId: ["updated_document_id"]}
      });
    });
    it("multiple data from request.body", () => {
      const req = {
        params: {},
        body: [{id: "updated_document_id"}, {id: "updated_document_id2"}],
        user: {
          identifier: "spica"
        },
        method: "PUT"
      };
      const controllerDetails: ControllerDetails = {
        moduleName: "TEST",
        documentIdKey: "id"
      };
      let activity = createActivity(req, {}, controllerDetails);
      expect(activity).toEqual({
        action: Action.PUT,
        identifier: "spica",
        resource: {moduleName: "TEST", documentId: ["updated_document_id", "updated_document_id2"]}
      });
    });
  });
  describe("DELETE", () => {
    it("single data from request.params", () => {
      const req = {
        params: {
          id: "deleted_document_id"
        },
        user: {
          identifier: "spica"
        },
        method: "DELETE"
      };
      const controllerDetails: ControllerDetails = {
        moduleName: "TEST",
        documentIdKey: "id"
      };
      let activity = createActivity(req, {}, controllerDetails);
      expect(activity).toEqual({
        action: Action.DELETE,
        identifier: "spica",
        resource: {moduleName: "TEST", documentId: ["deleted_document_id"]}
      });
    });

    it("multiple data from request.body", () => {
      const req = {
        params: {},
        body: ["deleted_document_id", "deleted_document_id2"],
        user: {
          identifier: "spica"
        },
        method: "DELETE"
      };
      const controllerDetails: ControllerDetails = {
        moduleName: "TEST",
        documentIdKey: ""
      };
      let activity = createActivity(req, {}, controllerDetails);
      expect(activity).toEqual({
        action: Action.DELETE,
        identifier: "spica",
        resource: {moduleName: "TEST", documentId: ["deleted_document_id", "deleted_document_id2"]}
      });
    });
  });

  //spesific for dynamic modules(e.g:bucket-data)
  it("should add module id to activity", () => {
    const req = {
      params: {
        bucketId: "bucket_id",
        documentId: "document_id"
      },
      user: {
        identifier: "spica"
      },
      method: "PUT"
    };
    const controllerDetails: ControllerDetails = {
      moduleName: "BUCKET-DATA",
      moduleIdKey: "bucketId",
      documentIdKey: "documentId"
    };
    let activity = createActivity(req, {}, controllerDetails);
    expect(activity).toEqual({
      action: Action.PUT,
      identifier: "spica",
      resource: {
        moduleName: "BUCKET-DATA",
        moduleId: "bucket_id",
        documentId: ["document_id"]
      }
    });
  });
});
