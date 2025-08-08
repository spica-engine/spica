import {Change} from "../../node";
import {Database} from "../../proto";

describe("Database", () => {
  describe("Change", () => {
    it("should map INSERT event", () => {
      const ch = new Database.Change();
      ch.kind = Database.Change.Kind.INSERT;
      ch.documentKey = "obj_id";
      ch.collection = "collection_name";
      ch.document = JSON.stringify({test: true});
      const change = new Change<{test: boolean}>(ch);
      expect(change.kind).toBe("insert");
      expect(change.collection).toBe(ch.collection);
      expect(change.documentKey).toBe(ch.documentKey);
      expect(change.document.test).toBe(true);
    });

    it("should map DELETE event", () => {
      const ch = new Database.Change();
      ch.kind = Database.Change.Kind.DELETE;
      ch.documentKey = "obj_id";
      ch.collection = "collection_name";
      const change = new Change(ch);
      expect(change.kind).toBe("delete");
      expect(change.collection).toBe(ch.collection);
      expect(change.documentKey).toBe(ch.documentKey);
      expect(change.document).toBe(undefined);
    });

    it("should map UPDATE event", () => {
      const ch = new Database.Change();
      ch.kind = Database.Change.Kind.UPDATE;
      ch.documentKey = "obj_id";
      ch.collection = "collection_name";
      ch.document = JSON.stringify({test: true});
      ch.updateDescription = new Database.Change.UpdateDescription();
      ch.updateDescription.removedFields = JSON.stringify([]);
      ch.updateDescription.updatedFields = JSON.stringify({test: true});

      const change = new Change<{test: boolean}>(ch);
      expect(change.kind).toBe("update");
      expect(change.collection).toBe(ch.collection);
      expect(change.documentKey).toBe(ch.documentKey);
      expect(change.document.test).toBe(true);
      expect(change.updateDescription.removedFields).toEqual([]);
      expect(change.updateDescription.updatedFields.test).toBe(true);
    });

    it("should map REPLACE event", () => {
      const ch = new Database.Change();
      ch.kind = Database.Change.Kind.REPLACE;
      ch.documentKey = "obj_id";
      ch.collection = "collection_name";
      ch.document = JSON.stringify({test: true});

      const change = new Change<{test: boolean}>(ch);
      expect(change.kind).toBe("replace");
      expect(change.collection).toBe(ch.collection);
      expect(change.documentKey).toBe(ch.documentKey);
      expect(change.document.test).toBe(true);
    });
  });
});
