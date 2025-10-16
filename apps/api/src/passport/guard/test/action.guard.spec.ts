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
    it("should throw an error if the resource does not match the definition", async () => {
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
              include: ["bucket1/row1/row1"],
              exclude: []
            },
            module: "bucket:data"
          }
        ]
      });
      await expect(guard()).rejects.toThrow(
        new Error(
          'Policy "Testing" contains a statement [0] whose resource does not match the resource definition. Expected 2 arguments.'
        )
      );
    });

    it("should throw an error if the wildcard resource does not match the definition", async () => {
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
              include: ["*/*/row1"],
              exclude: []
            },
            module: "bucket:data"
          }
        ]
      });
      await expect(guard()).rejects.toThrow(
        new Error(
          'Policy "Testing" contains a statement [0] whose resource does not match the resource definition. Expected 2 arguments.'
        )
      );
    });

    it("should throw an error if the empty resource does not match the definition", async () => {
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
            module: "bucket:data"
          }
        ]
      });
      await expect(guard()).rejects.toThrow(
        new Error(
          'Policy "Testing" contains a statement [0] whose resource does not match the resource definition. Expected 2 arguments.'
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

      it("should generate correct resource filter for the same bucket definitions", async () => {
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
                include: ["bucket1/*"],
                exclude: []
              },
              module: "bucket:data"
            },
            {
              action: "bucket:data:index",
              resource: {
                include: ["bucket1/row1"],
                exclude: []
              },
              module: "bucket:data"
            }
          ],
          resourceFilter: true
        });
        await guard();

        expect(request.resourceFilter).toEqual({
          include: [],
          exclude: []
        });
      });

      it("should generate correct resource filter for different buckets", async () => {
        const options = {
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
                include: ["bucket2/*"],
                exclude: []
              },
              module: "bucket:data"
            }
          ],
          resourceFilter: true
        };
        const {guard, request} = createGuardAndRequest(options);
        await guard();

        expect(request.resourceFilter).toEqual({
          include: ["row1"],
          exclude: []
        });

        const {guard: guard2, request: request2} = createGuardAndRequest({
          ...options,
          params: {id: "bucket2"}
        });
        await guard2();

        expect(request2.resourceFilter).toEqual({
          include: [],
          exclude: []
        });
      });
    });

    describe("rejects", () => {
      it("should reject if the first portion of the wildcard resource does not match", async () => {
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
                include: ["bucket2/row1"],
                exclude: []
              },
              module: "bucket:data"
            }
          ],
          resourceFilter: true
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
      it("should not reject if all resource is excluded but another statement allows it", async () => {
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
                exclude: ["bucket1/*"]
              },
              module: "bucket:data"
            },
            {
              action: "bucket:data:index",
              resource: {
                include: ["*/*"],
                exclude: ["bucket1/row1", "bucket1/row2"]
              },
              module: "bucket:data"
            }
          ],
          resourceFilter: true
        });

        await guard();
        expect(request.resourceFilter).toEqual({
          include: [],
          exclude: [["row1", "row2"]]
        });
      });
      it("should generate excluded resources correctly", async () => {
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
                exclude: ["bucket1/row1"]
              },
              module: "bucket:data"
            },
            {
              action: "bucket:data:index",
              resource: {
                include: ["*/*"],
                exclude: ["bucket1/row2"]
              },
              module: "bucket:data"
            }
          ],
          resourceFilter: true
        });

        await guard();

        expect(request.resourceFilter).toEqual({
          include: [],
          exclude: [["row1"], ["row2"]]
        });
      });
    });

    describe("rejects", () => {
      it("should reject if all resource is excluded and should not be filtered out", async () => {
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
                include: ["*/*"],
                exclude: ["bucket1/*"]
              },
              module: "bucket:data"
            }
          ],
          resourceFilter: true
        });

        await expect(guard()).rejects.toThrow(
          new Error(
            "You do not have sufficient permissions to do bucket:data:index on resource bucket1"
          )
        );
      });

      it("should reject if all resource is excluded and has no resource filter", async () => {
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
                include: ["*/*"],
                exclude: ["bucket1/*"]
              },
              module: "bucket:data"
            }
          ]
        });

        await expect(guard()).rejects.toThrow(
          new Error(
            "You do not have sufficient permissions to do bucket:data:show on resource bucket1/row1"
          )
        );
      });

      it("should reject if the resource is excluded", async () => {
        const {guard} = createGuardAndRequest({
          actions: "bucket:data:show",
          path: "/bucket/:id/data/:row",
          params: {
            id: "bucket1",
            row: "row2"
          },
          statements: [
            {
              action: "bucket:data:show",
              resource: {
                include: ["bucket1/row1"],
                exclude: ["bucket1/row2"]
              },
              module: "bucket:data"
            }
          ]
        });

        await expect(guard()).rejects.toThrow(
          new Error(
            "You do not have sufficient permissions to do bucket:data:show on resource bucket1/row2"
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
