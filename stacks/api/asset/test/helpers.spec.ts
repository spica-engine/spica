import {
  Asset,
  Configuration,
  eliminateNonConfigurables,
  putConfiguration,
  replaceValue
} from "@spica-server/asset";
import {ObjectId} from "@spica-server/database";

describe("Helpers", () => {
  describe("replaceValue", () => {
    let val;

    beforeEach(() => {
      val = {
        root: "me",
        nested: {
          only: {
            me: "here"
          },
          not: {
            me: "not me"
          }
        }
      };
    });

    it("should replace value of root property", () => {
      const property = "root";
      const replace = "REPLACED";

      const res = replaceValue(val, property, replace);

      expect(res).toEqual({
        root: "REPLACED",
        nested: {
          only: {
            me: "here"
          },
          not: {
            me: "not me"
          }
        }
      });
    });

    it("should replace value of nested property", () => {
      const property = "nested.only.me";
      const replace = "REPLACED";

      const res = replaceValue(val, property, replace);

      expect(res).toEqual({
        root: "me",
        nested: {
          only: {
            me: "REPLACED"
          },
          not: {
            me: "not me"
          }
        }
      });
    });
  });

  describe("eliminateNonConfigurables", () => {
    it("should filter configurables", () => {
      const _id = new ObjectId();
      const actual: Configuration[] = [
        {
          module: "dashboard",
          resource_id: _id.toString(),
          submodule: "schema",
          property: "properties.name",
          value: "your_dashboard"
        }
      ];

      const desired: Configuration[] = [
        {
          module: "dashboard",
          resource_id: _id.toString(),
          submodule: "schema",
          property: "properties.name",
          value: "my_dahsboard"
        },
        {
          module: "bucket",
          resource_id: "some_id",
          submodule: "schema",
          property: "properties.title.type",
          value: "number"
        }
      ];

      const configurables = eliminateNonConfigurables(actual, desired);
      expect(configurables).toEqual([
        {
          module: "dashboard",
          resource_id: _id.toString(),
          submodule: "schema",
          property: "properties.name",
          // it's important to keep value of desired configuration
          value: "my_dahsboard"
        }
      ]);
    });
  });

  describe("putConfiguration", () => {
    let asset: Asset;

    const bucketId = new ObjectId();
    const fnId = new ObjectId();

    beforeEach(() => {
      asset = {
        name: "asset1",
        description: "description of the asset",
        configs: [
          {
            module: "bucket",
            resource_id: bucketId.toString(),
            submodule: "schema",
            property: "properties.role.enum",
            value: ["user"]
          },
          {
            module: "function",
            resource_id: fnId.toString(),
            submodule: "env",
            property: "CARD",
            value: "**** **** **** ****"
          }
        ],
        status: "downloaded",
        resources: [
          {
            _id: bucketId,
            module: "bucket",
            contents: {
              schema: {
                properties: {
                  role: {
                    type: "string",
                    enum: ["user"]
                  }
                }
              }
            }
          },
          {
            _id: fnId,
            module: "function",
            contents: {
              schema: {
                triggers: {
                  default: {}
                }
              },
              env: {
                CARD: "**** **** **** ****"
              }
            }
          }
        ]
      };
    });

    it("should put bucket schema and function environment configurations", () => {
      const configs = [
        {
          module: "bucket",
          resource_id: bucketId.toString(),
          submodule: "schema",
          property: "properties.role.enum",
          value: ["admin", "user"]
        },
        {
          module: "function",
          resource_id: fnId.toString(),
          submodule: "env",
          property: "CARD",
          value: "4242 4242 4242 4242"
        }
      ];

      asset = putConfiguration(asset, configs);

      expect(asset).toEqual({
        name: "asset1",
        description: "description of the asset",
        configs: [
          {
            module: "bucket",
            resource_id: bucketId.toString(),
            submodule: "schema",
            property: "properties.role.enum",
            value: ["admin", "user"]
          },
          {
            module: "function",
            resource_id: fnId.toString(),
            submodule: "env",
            property: "CARD",
            value: "4242 4242 4242 4242"
          }
        ],
        status: "downloaded",
        resources: [
          {
            _id: bucketId,
            module: "bucket",
            contents: {
              schema: {
                properties: {
                  role: {
                    type: "string",
                    enum: ["admin", "user"]
                  }
                }
              }
            }
          },
          {
            _id: fnId,
            module: "function",
            contents: {
              schema: {
                triggers: {
                  default: {}
                }
              },
              env: {
                CARD: "4242 4242 4242 4242"
              }
            }
          }
        ]
      });
    });
  });
});
