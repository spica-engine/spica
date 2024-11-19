import {eliminateNonConfigurables, putConfiguration, replaceValue} from "@spica/api/src/asset";
import {ObjectId} from "@spica/database";
import {Asset, Config} from "@spica/interface";

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
      const actual: Config[] = [
        {
          title: "Set dashboard name",
          module: "dashboard",
          resource_id: _id.toString(),
          submodule: "schema",
          property: "properties.name",
          value: "your_dashboard",
          type: "string"
        }
      ];

      const desired: Config[] = [
        {
          title: "Set dashboard name",
          module: "dashboard",
          resource_id: _id.toString(),
          submodule: "schema",
          property: "properties.name",
          value: "my_dahsboard",
          type: "string"
        },
        {
          title: "Set bucket title type",
          module: "bucket",
          resource_id: "some_id",
          submodule: "schema",
          property: "properties.title.type",
          value: "number",
          type: "string"
        }
      ];

      const configurables = eliminateNonConfigurables(actual, desired);
      expect(configurables).toEqual([
        {
          title: "Set dashboard name",
          module: "dashboard",
          resource_id: _id.toString(),
          submodule: "schema",
          property: "properties.name",
          // it's important to keep value of desired configuration
          value: "my_dahsboard",
          type: "string"
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
        icon: "icon1",
        url: "test.com",
        name: "asset1",
        description: "description of the asset",
        configs: [
          {
            title: "Default role",
            module: "bucket",
            resource_id: bucketId.toString(),
            submodule: "schema",
            property: "properties.role.default",
            value: "user",
            type: "string"
          },
          {
            title: "Card ID",
            module: "function",
            resource_id: fnId.toString(),
            submodule: "env",
            property: "CARD",
            value: "**** **** **** ****",
            type: "string"
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
                    default: "user"
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
      const configs: Config[] = [
        {
          title: "Default role",
          module: "bucket",
          resource_id: bucketId.toString(),
          submodule: "schema",
          property: "properties.role.default",
          value: "user",
          type: "string"
        },
        {
          title: "Card ID",
          module: "function",
          resource_id: fnId.toString(),
          submodule: "env",
          property: "CARD",
          value: "4242 4242 4242 4242",
          type: "string"
        }
      ];

      asset = putConfiguration(asset, configs);

      expect(asset).toEqual({
        icon: "icon1",
        url: "test.com",
        name: "asset1",
        description: "description of the asset",
        configs: [
          {
            title: "Default role",
            module: "bucket",
            resource_id: bucketId.toString(),
            submodule: "schema",
            property: "properties.role.default",
            value: "user",
            type: "string"
          },
          {
            title: "Card ID",
            module: "function",
            resource_id: fnId.toString(),
            submodule: "env",
            property: "CARD",
            value: "4242 4242 4242 4242",
            type: "string"
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
                    default: "user"
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
