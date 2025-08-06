import {ExecutionContext} from "@nestjs/common";
import {SimpleActionGuard, ResourceFilter} from "@spica-server/passport/guard";
import {PolicyResolver} from "@spica-server/interface/passport/guard";

describe("SimpleActionGuard", () => {
  function createGuardAndRequest(options: {
    statements: any[];
    actions: string | string[];
    path: string;
    params: {[k: string]: string};
    format?: string;
  }): {guard: () => Promise<boolean>; request: any} {
    const type = SimpleActionGuard(options.actions, options.format);
    const resolver: PolicyResolver = async () => [
      {
        name: "Testing",
        statement: options.statements
      }
    ];
    const guard = new type(resolver);
    const request = {
      route: {
        path: options.path
      },
      params: options.params,
      user: {
        policies: ["Testing"]
      }
    };

    class TestingController {
      testing(@ResourceFilter() resourceFilter: object) {}
    }

    Reflect.defineMetadata("resourceFilter", {key: "testing", index: 0}, TestingController);

    const ctx = {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => ({
          header: () => {}
        })
      }),
      getClass: () => TestingController,
      getHandler: () => ({name: "testing"})
    };

    return {
      guard: () => {
        return guard.canActivate(ctx as ExecutionContext) as Promise<boolean>;
      },
      request
    };
  }

  describe("successful authorization", () => {
    it("should allow access when action and module match", async () => {
      const {guard, request} = createGuardAndRequest({
        actions: "bucket:data:show",
        path: "/bucket/:id/data/:row",
        params: {
          id: "bucket1",
          row: "row1"
        },
        statements: [
          {
            action: "bucket:data:show",
            resource: {
              include: ["bucket1/row1"],
              exclude: []
            },
            module: "bucket:data"
          }
        ]
      });

      expect(await guard()).toBe(true);
      expect(request.resourceFilter).toEqual({
        include: ["bucket1/row1"],
        exclude: []
      });
    });

    it("should handle multiple policies with same action and module", async () => {
      const {guard, request} = createGuardAndRequest({
        actions: "bucket:data:index",
        path: "/bucket/:id/data",
        params: {
          id: "bucket1"
        },
        statements: [
          {
            action: "bucket:data:index",
            resource: {
              include: ["bucket1/row1"],
              exclude: []
            },
            module: "bucket:data"
          },
          {
            action: "bucket:data:index",
            resource: {
              include: ["bucket1/row2"],
              exclude: ["bucket1/row3"]
            },
            module: "bucket:data"
          }
        ]
      });

      expect(await guard()).toBe(true);
      expect(request.resourceFilter).toEqual({
        include: ["bucket1/row1", "bucket1/row2"],
        exclude: ["bucket1/row3"]
      });
    });

    it("should handle multiple actions", async () => {
      const {guard, request} = createGuardAndRequest({
        actions: ["bucket:data:show", "bucket:data:update"],
        path: "/bucket/:id/data/:row",
        params: {
          id: "bucket1",
          row: "row1"
        },
        statements: [
          {
            action: "bucket:data:show",
            resource: {
              include: ["bucket1/row1"],
              exclude: []
            },
            module: "bucket:data"
          },
          {
            action: "bucket:data:update",
            resource: {
              include: ["bucket1/row2"],
              exclude: []
            },
            module: "bucket:data"
          }
        ]
      });

      expect(await guard()).toBe(true);
      expect(request.resourceFilter).toEqual({
        include: ["bucket1/row1", "bucket1/row2"],
        exclude: []
      });
    });

    it("should handle wildcard resources without validation", async () => {
      const {guard, request} = createGuardAndRequest({
        actions: "bucket:data:index",
        path: "/bucket/:id/data",
        params: {
          id: "bucket1"
        },
        statements: [
          {
            action: "bucket:data:index",
            resource: {
              include: ["*/*"],
              exclude: ["bucket2/*"]
            },
            module: "bucket:data"
          }
        ]
      });

      expect(await guard()).toBe(true);
      expect(request.resourceFilter).toEqual({
        include: ["*/*"],
        exclude: ["bucket2/*"]
      });
    });

    it("should handle statements without resource", async () => {
      const {guard, request} = createGuardAndRequest({
        actions: "bucket:create",
        path: "/bucket",
        params: {},
        statements: [
          {
            action: "bucket:create",
            module: "bucket"
          }
        ]
      });

      expect(await guard()).toBe(true);
      expect(request.resourceFilter).toEqual({
        include: [],
        exclude: []
      });
    });

    it("should handle custom format parameter", async () => {
      const {guard, request} = createGuardAndRequest({
        actions: "custom:action",
        path: "/custom/:id",
        params: {
          id: "test1"
        },
        format: "/custom/format/:id",
        statements: [
          {
            action: "custom:action",
            resource: {
              include: ["test/resource"],
              exclude: []
            },
            module: "custom:format"
          }
        ]
      });

      expect(await guard()).toBe(true);
      expect(request.resourceFilter).toEqual({
        include: ["test/resource"],
        exclude: []
      });
    });

    it("should handle complex resource patterns without splitting", async () => {
      const {guard, request} = createGuardAndRequest({
        actions: "bucket:data:show",
        path: "/bucket/:id/data/:row",
        params: {
          id: "bucket1",
          row: "row1"
        },
        statements: [
          {
            action: "bucket:data:show",
            resource: {
              include: ["bucket1/row1/subrow1", "bucket2/row2/subrow2"],
              exclude: ["bucket1/row1/subrow2"]
            },
            module: "bucket:data"
          }
        ]
      });

      expect(await guard()).toBe(true);
      expect(request.resourceFilter).toEqual({
        include: ["bucket1/row1/subrow1", "bucket2/row2/subrow2"],
        exclude: ["bucket1/row1/subrow2"]
      });
    });
  });

  describe("authorization failures", () => {
    it("should throw ForbiddenException when no matching action", async () => {
      const {guard} = createGuardAndRequest({
        actions: "bucket:data:show",
        path: "/bucket/:id/data/:row",
        params: {
          id: "bucket1",
          row: "row1"
        },
        statements: [
          {
            action: "bucket:data:update",
            resource: {
              include: ["bucket1/row1"],
              exclude: []
            },
            module: "bucket:data"
          }
        ]
      });

      await expect(guard()).rejects.toThrow(
        "You do not have sufficient permissions to do bucket:data:show on resource bucket1/row1"
      );
    });

    it("should throw ForbiddenException when no matching module", async () => {
      const {guard} = createGuardAndRequest({
        actions: "bucket:data:show",
        path: "/bucket/:id/data/:row",
        params: {
          id: "bucket1",
          row: "row1"
        },
        statements: [
          {
            action: "bucket:data:show",
            resource: {
              include: ["bucket1/row1"],
              exclude: []
            },
            module: "user:data"
          }
        ]
      });

      await expect(guard()).rejects.toThrow(
        "You do not have sufficient permissions to do bucket:data:show on resource bucket1/row1"
      );
    });

    it("should throw ForbiddenException when no policies match", async () => {
      const {guard} = createGuardAndRequest({
        actions: "bucket:data:show",
        path: "/bucket/:id/data/:row",
        params: {
          id: "bucket1",
          row: "row1"
        },
        statements: []
      });

      await expect(guard()).rejects.toThrow(
        "You do not have sufficient permissions to do bucket:data:show on resource bucket1/row1"
      );
    });

    it("should set empty resource filter even when authorization fails", async () => {
      const {guard, request} = createGuardAndRequest({
        actions: "bucket:data:show",
        path: "/bucket/:id/data/:row",
        params: {
          id: "bucket1",
          row: "row1"
        },
        statements: [
          {
            action: "bucket:data:update",
            resource: {
              include: ["bucket1/row1"],
              exclude: []
            },
            module: "bucket:data"
          }
        ]
      });

      try {
        await guard();
      } catch (error) {
        // Resource filter should still be set even when authorization fails
        expect(request.resourceFilter).toEqual({
          include: [],
          exclude: []
        });
      }
    });
  });

  describe("testing mode", () => {
    it("should skip checks and set empty resource filter in testing mode", async () => {
      const {guard, request} = createGuardAndRequest({
        actions: "bucket:data:show",
        path: "/bucket/:id/data/:row",
        params: {
          id: "bucket1",
          row: "row1"
        },
        statements: []
      });

      request.TESTING_SKIP_CHECK = true;

      expect(await guard()).toBe(true);
      expect(request.resourceFilter).toEqual({
        include: [],
        exclude: []
      });
    });
  });

  describe("edge cases", () => {
    it("should handle statements with null resource", async () => {
      const {guard, request} = createGuardAndRequest({
        actions: "bucket:create",
        path: "/bucket",
        params: {},
        statements: [
          {
            action: "bucket:create",
            resource: null,
            module: "bucket"
          }
        ]
      });

      expect(await guard()).toBe(true);
      expect(request.resourceFilter).toEqual({
        include: [],
        exclude: []
      });
    });

    it("should handle statements with string resource", async () => {
      const {guard, request} = createGuardAndRequest({
        actions: "bucket:create",
        path: "/bucket",
        params: {},
        statements: [
          {
            action: "bucket:create",
            resource: "string-resource",
            module: "bucket"
          }
        ]
      });

      expect(await guard()).toBe(true);
      expect(request.resourceFilter).toEqual({
        include: [],
        exclude: []
      });
    });

    it("should handle partial resource objects", async () => {
      const {guard, request} = createGuardAndRequest({
        actions: "bucket:data:show",
        path: "/bucket/:id/data/:row",
        params: {
          id: "bucket1",
          row: "row1"
        },
        statements: [
          {
            action: "bucket:data:show",
            resource: {
              include: ["bucket1/row1"]
              // exclude is missing
            },
            module: "bucket:data"
          }
        ]
      });

      expect(await guard()).toBe(true);
      expect(request.resourceFilter).toEqual({
        include: ["bucket1/row1"],
        exclude: []
      });
    });

    it("should handle resource objects with only exclude", async () => {
      const {guard, request} = createGuardAndRequest({
        actions: "bucket:data:show",
        path: "/bucket/:id/data/:row",
        params: {
          id: "bucket1",
          row: "row1"
        },
        statements: [
          {
            action: "bucket:data:show",
            resource: {
              exclude: ["bucket1/row2"]
              // include is missing
            },
            module: "bucket:data"
          }
        ]
      });

      expect(await guard()).toBe(true);
      expect(request.resourceFilter).toEqual({
        include: [],
        exclude: ["bucket1/row2"]
      });
    });
  });
});
