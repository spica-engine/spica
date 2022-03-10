import {ObjectActionDecider} from "@spica/cli/src/commands/project/sync";

describe("Synchronize", () => {
  describe("ObjectSynchronizer", () => {
    it("should get insert object", () => {
      const sourceObjects = [{_id: "1"}];
      const targetObjects = [];

      const synchronizer = new ObjectActionDecider(sourceObjects, targetObjects);

      expect(synchronizer.getInsertObjects()).toEqual([{_id: "1"}]);
    });

    it("should get update objects", () => {
      const sourceObjects = [{_id: "1", test: "a"}];
      const targetObjects = [{_id: "1", test: "b"}];

      const synchronizer = new ObjectActionDecider(sourceObjects, targetObjects);

      expect(synchronizer.getUpdateObjects()).toEqual([
        {_id: "1",test:"a"}
      ]);
    });

    it("should not get any update object if they are same", () => {
      const sourceObjects = [{_id: "1", test: "a"}];
      const targetObjects = [{_id: "1", test: "a"}];

      const synchronizer = new ObjectActionDecider(sourceObjects, targetObjects);

      expect(synchronizer.getUpdateObjects()).toEqual([]);
    });

    it("should get delete objects", () => {
      const sourceObjects = [];
      const targetObjects = [{_id: "2"}];

      const synchronizer = new ObjectActionDecider(sourceObjects, targetObjects);

      expect(synchronizer.getDeleteObjects()).toEqual([{_id: "2"}]);
    });

    it("should get all of them correctly", () => {
      const sourceObjects = [
        // insert
        {_id: "1", test: "a"},
        // update
        {_id: "2", test: "b"},
        // not update
        {_id: "3", test: "c"}
      ];

      const targetObjects = [
        // update
        {_id: "2", test: "z"},
        // not update
        {_id: "3", test: "c"},
        // delete
        {_id: "4", test: "d"}
      ];

      const synchronizer = new ObjectActionDecider(sourceObjects, targetObjects);

      expect(synchronizer.getInsertObjects()).toEqual([{_id: "1", test: "a"}]);
      expect(synchronizer.getUpdateObjects()).toEqual([{_id: "2", test: "b"}]);
      expect(synchronizer.getDeleteObjects()).toEqual([{_id: "4", test: "d"}]);
    });

    it("should not get any insert, update, delete object", () => {
      const sourceObjects = [];
      const targetObjects = [];

      const synchronizer = new ObjectActionDecider(sourceObjects, targetObjects);

      expect(synchronizer.getInsertObjects()).toEqual([]);
      expect(synchronizer.getUpdateObjects()).toEqual([]);
      expect(synchronizer.getDeleteObjects()).toEqual([]);
    });
  });
});
