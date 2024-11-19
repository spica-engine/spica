import {Policy} from "@spica/api/src/passport/policy";
import {
  getDuplicatedActionMaps,
  createDuplicatedActionsErrorMessage
} from "@spica/api/src/passport/policy/src/utility";

const policy: Policy = {
  _id: "test",
  name: "my_policy",
  statement: [
    {
      action: "activity:index",
      module: "activity"
    },
    {
      action: "bucket:create",
      module: "bucket"
    },
    {
      action: "activity:index",
      module: "activity"
    },
    {
      action: "bucket:index",
      module: "bucket",
      resource: "*"
    },
    {
      action: "bucket:create",
      module: "bucket"
    },
    {
      action: "activity:index",
      module: "activity"
    }
  ]
};

describe("Utility", () => {
  describe("getDuplicatedActionMaps", () => {
    it("should return duplicated actions with occurrence indexes", () => {
      const duplicatedActionMaps = getDuplicatedActionMaps(policy);

      expect(duplicatedActionMaps).toEqual([
        {
          action: "activity:index",
          indexes: [0, 2, 5]
        },
        {
          action: "bucket:create",
          indexes: [1, 4]
        }
      ]);
    });
  });

  describe("createDuplicatedActionsErrorMessage", () => {
    it("should create error message", () => {
      const duplicatedActionMaps = getDuplicatedActionMaps(policy);

      const errorMessage = createDuplicatedActionsErrorMessage(duplicatedActionMaps);

      expect(errorMessage).toEqual(
        `statement[0], statement[2], statement[5] includes the same action: 'activity:index'.
statement[1], statement[4] includes the same action: 'bucket:create'.`
      );
    });
  });
});
