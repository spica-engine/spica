import {ExecutionContext} from "@nestjs/common";
import {ActionGuard, PolicyResolver} from "@spica-server/passport/guard";

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
      Reflect.defineMetadata("resourceFilter", {key: "testing", index: 0}, TestingController);
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

  describe("matching the resource against definition", () => {
    it("should throw an error if the resource does not match the definition", async () => {
      const {guard} = createGuardAndRequest({
        actions: "bucket:data:show",
        path: "/bucket/:id/data/:row",
        params: {
          id: "test",
          row: "test1"
        },
        statements: [
          {
            action: "bucket:data:show",
            resource: ["test/test1/test1"],
            module: "bucket:data"
          }
        ]
      });
      await expectAsync(guard()).toBeRejectedWith(
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
          id: "test",
          row: "test1"
        },
        statements: [
          {
            action: "bucket:data:show",
            resource: {
              include: "*/*/test1"
            },
            module: "bucket:data"
          }
        ]
      });
      await expectAsync(guard()).toBeRejectedWith(
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
          id: "test",
          row: "test1"
        },
        statements: [
          {
            action: "bucket:data:show",
            module: "bucket:data"
          }
        ]
      });
      await expectAsync(guard()).toBeRejectedWith(
        new Error(
          'Policy "Testing" contains a statement [0] whose resource does not match the resource definition. Expected 2 arguments.'
        )
      );
    });
  });

  it("should generate included resources correctly", async () => {
    const {guard, request} = createGuardAndRequest({
      actions: "bucket:data:index",
      path: "/bucket/:id/data",
      params: {
        id: "test"
      },
      statements: [
        {
          action: "bucket:data:index",
          resource: ["test/test1"],
          module: "bucket:data"
        },
        {
          action: "bucket:data:index",
          resource: ["test/test2"],
          module: "bucket:data"
        },
        {
          action: "bucket:data:index",
          resource: {
            include: "test/*"
          },
          module: "bucket:data"
        },
        {
          action: "bucket:data:index",
          resource: {
            include: "test/test3"
          },
          module: "bucket:data"
        }
      ],
      resourceFilter: true
    });
    await guard();

    // We expect the wildcard to not appear in the include array
    expect(request.resourceFilter).toEqual({
      include: ["test1", "test2", "test3"],
      exclude: []
    });
  });

  it("should generate included resources correctly with empty exclude and wildcard include", async () => {
    const {guard, request} = createGuardAndRequest({
      actions: "bucket:data:index",
      path: "/bucket/:id/data",
      params: {
        id: "test"
      },
      statements: [
        {
          action: "bucket:data:index",
          resource: {
            include: "test/*"
          },
          module: "bucket:data"
        },
        {
          action: "bucket:data:index",
          resource: {
            include: "test/*"
          },
          module: "bucket:data"
        }
      ],
      resourceFilter: true
    });
    await guard();

    // We expect the wildcard to not appear in the include array
    expect(request.resourceFilter).toEqual({
      include: [],
      exclude: []
    });
  });

  it("should generate excluded resources correctly", async () => {
    const {guard, request} = createGuardAndRequest({
      actions: "bucket:data:index",
      path: "/bucket/:id/data",
      params: {
        id: "test"
      },
      statements: [
        {
          action: "bucket:data:index",
          resource: {
            include: "*/*",
            exclude: ["test1"]
          },
          module: "bucket:data"
        },
        {
          action: "bucket:data:index",
          resource: {
            include: "*/*",
            exclude: ["test2"]
          },
          module: "bucket:data"
        }
      ],
      resourceFilter: true
    });

    await guard();

    expect(request.resourceFilter).toEqual({
      include: [],
      exclude: [["test1"], ["test2"]]
    });
  });

  it("should reject if the first portion of the wildcard resource does not match", async () => {
    const {guard} = createGuardAndRequest({
      actions: "bucket:data:index",
      path: "/bucket/:id/data",
      params: {
        id: "test1"
      },
      statements: [
        {
          action: "bucket:data:index",
          resource: {
            include: "test/not_evaluated_yet",
            exclude: []
          },
          module: "bucket:data"
        }
      ],
      resourceFilter: true
    });

    await expectAsync(guard()).toBeRejectedWith(
      new Error("You do not have sufficient permissions to do bucket:data:index on resource test1")
    );
  });

  it("should reject if the resource is excluded", async () => {
    const {guard} = createGuardAndRequest({
      actions: "bucket:data:show",
      path: "/bucket/:id/data/:row",
      params: {
        id: "test1",
        row: "test2"
      },
      statements: [
        {
          action: "bucket:data:show",
          resource: {
            include: "test/test1",
            exclude: ["test2"]
          },
          module: "bucket:data"
        }
      ]
    });

    await expectAsync(guard()).toBeRejectedWith(
      new Error(
        "You do not have sufficient permissions to do bucket:data:show on resource test1/test2"
      )
    );
  });

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
});
