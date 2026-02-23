import {ExecutionContext} from "@nestjs/common";
import {ActionGuard} from "@spica-server/passport/guard";
import {PolicyResolver} from "@spica-server/interface/passport/guard";

describe("ActionGuard", () => {
  function createGuardAndRequest(options: {
    statements: any[];
    actions: string | string[];
    path: string;
    resourceFilter?: boolean;
    params: {[k: string]: string};
  }): {guard: () => Promise<boolean>; request: any} {
    const type = ActionGuard(options.actions);
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

    class TestingController {}

    if (options.resourceFilter) {
      Reflect.defineMetadata(
        "resourceFilter",
        {key: "testing", index: 0},
        TestingController,
        "testing"
      );
    }

    const ctx = {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => ({})
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

  describe("errors", () => {
    it("should throw an error if the resource does not match the definition for bucket:data", async () => {
      const {guard} = createGuardAndRequest({
        actions: "bucket:data:show",
        path: "/bucket/:id/data",
        params: {
          id: "bucket1"
        },
        statements: [
          {
            action: "bucket:data:show",
            resource: {
              include: ["bucket1/extra"],
              exclude: []
            },
            module: "bucket:data"
          }
        ]
      });
      await expect(guard()).rejects.toThrow(
        new Error(
          'Policy "Testing" contains a statement [0] whose resource does not match the resource definition. Expected 1 arguments.'
        )
      );
    });

    it("should throw an error if the wildcard resource does not match the definition for bucket:data", async () => {
      const {guard} = createGuardAndRequest({
        actions: "bucket:data:show",
        path: "/bucket/:id/data",
        params: {
          id: "bucket1"
        },
        statements: [
          {
            action: "bucket:data:show",
            resource: {
              include: ["*/extra"],
              exclude: []
            },
            module: "bucket:data"
          }
        ]
      });
      await expect(guard()).rejects.toThrow(
        new Error(
          'Policy "Testing" contains a statement [0] whose resource does not match the resource definition. Expected 1 arguments.'
        )
      );
    });

    it("should throw an error if the empty resource does not match the definition for bucket:data", async () => {
      const {guard} = createGuardAndRequest({
        actions: "bucket:data:show",
        path: "/bucket/:id/data",
        params: {
          id: "bucket1"
        },
        statements: [
          {
            action: "bucket:data:show",
            module: "bucket:data"
          }
        ]
      });
      await expect(guard()).rejects.toThrow(
        new Error(
          'Policy "Testing" contains a statement [0] whose resource does not match the resource definition. Expected 1 arguments.'
        )
      );
    });
  });

  describe("include", () => {
    describe("allows", () => {
      it("should not reject if the resource is empty and matches the definition", async () => {
        const {guard} = createGuardAndRequest({
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
      });

      it("should allow bucket:data:index when policy grants wildcard bucket access", async () => {
        const {guard} = createGuardAndRequest({
          actions: "bucket:data:index",
          path: "/bucket/:id/data",
          params: {
            id: "bucket1"
          },
          statements: [
            {
              action: "bucket:data:index",
              resource: {
                include: ["*"],
                exclude: []
              },
              module: "bucket:data"
            }
          ]
        });
        expect(await guard()).toBe(true);
      });

      it("should allow bucket:data:index when policy grants specific bucket access", async () => {
        const {guard} = createGuardAndRequest({
          actions: "bucket:data:index",
          path: "/bucket/:id/data",
          params: {
            id: "bucket1"
          },
          statements: [
            {
              action: "bucket:data:index",
              resource: {
                include: ["bucket1"],
                exclude: []
              },
              module: "bucket:data"
            }
          ]
        });
        expect(await guard()).toBe(true);
      });

      it("should allow bucket:data:show when policy grants matching bucket access", async () => {
        const {guard} = createGuardAndRequest({
          actions: "bucket:data:show",
          path: "/bucket/:id/data",
          params: {
            id: "bucket1"
          },
          statements: [
            {
              action: "bucket:data:show",
              resource: {
                include: ["bucket1"],
                exclude: []
              },
              module: "bucket:data"
            }
          ]
        });
        expect(await guard()).toBe(true);
      });
    });

    describe("rejects", () => {
      it("should reject bucket:data:index if the bucket id does not match", async () => {
        const {guard} = createGuardAndRequest({
          actions: "bucket:data:index",
          path: "/bucket/:id/data",
          params: {
            id: "bucket1"
          },
          statements: [
            {
              action: "bucket:data:index",
              resource: {
                include: ["bucket2"],
                exclude: []
              },
              module: "bucket:data"
            }
          ]
        });

        await expect(guard()).rejects.toThrow(
          new Error(
            "You do not have sufficient permissions to do bucket:data:index on resource bucket1"
          )
        );
      });
    });
  });

  describe("exclude", () => {
    describe("allows", () => {
      it("should allow bucket:data when a different bucket is excluded", async () => {
        const {guard} = createGuardAndRequest({
          actions: "bucket:data:show",
          path: "/bucket/:id/data",
          params: {
            id: "bucket1"
          },
          statements: [
            {
              action: "bucket:data:show",
              resource: {
                include: ["*"],
                exclude: ["bucket2"]
              },
              module: "bucket:data"
            }
          ]
        });
        expect(await guard()).toBe(true);
      });
    });

    describe("rejects", () => {
      it("should reject bucket:data:show if the bucket is excluded", async () => {
        const {guard} = createGuardAndRequest({
          actions: "bucket:data:show",
          path: "/bucket/:id/data",
          params: {
            id: "bucket1"
          },
          statements: [
            {
              action: "bucket:data:show",
              resource: {
                include: ["*"],
                exclude: ["bucket1"]
              },
              module: "bucket:data"
            }
          ]
        });

        await expect(guard()).rejects.toThrow(
          new Error(
            "You do not have sufficient permissions to do bucket:data:show on resource bucket1"
          )
        );
      });

      it("should reject bucket:data:index if the bucket is excluded", async () => {
        const {guard} = createGuardAndRequest({
          actions: "bucket:data:index",
          path: "/bucket/:id/data",
          params: {
            id: "bucket1"
          },
          statements: [
            {
              action: "bucket:data:index",
              resource: {
                include: ["*"],
                exclude: ["bucket1"]
              },
              module: "bucket:data"
            }
          ]
        });

        await expect(guard()).rejects.toThrow(
          new Error(
            "You do not have sufficient permissions to do bucket:data:index on resource bucket1"
          )
        );
      });
    });

    it("should reject if the resource does not match", async () => {
      const {guard} = createGuardAndRequest({
        actions: "custom",
        path: "/:id/:row",
        params: {
          id: "bucket1",
          row: "row1"
        },
        statements: [
          {
            action: "custom",
            resource: {
              include: ["*/*"],
              exclude: ["bucket1/row1"]
            },
            module: ""
          }
        ]
      });

      await expect(guard()).rejects.toThrow(
        new Error("You do not have sufficient permissions to do custom on resource bucket1/row1")
      );
    });
  });
});
