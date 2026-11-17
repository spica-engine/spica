import {
  assignId,
  bindIdTypes,
  idOf,
  omitId,
  stripId,
  systemKeyField,
  withId
} from "@spica-server/data";
import {IdTypes, Keyed} from "@spica-server/interface-data";

interface Identity {
  identifier: string;
  policies?: string[];
}

describe("system record keys", () => {
  afterEach(() => bindIdTypes(undefined as IdTypes));

  describe.each(["ref", "id"])("when the system key is %s", key => {
    beforeEach(() => bindIdTypes({systemKeyField: () => key} as unknown as IdTypes));

    it("should report the system key field", () => {
      expect(systemKeyField()).toBe(key);
    });

    it("should read the id from the system key", () => {
      const record = {[key]: "abc", identifier: "admin"} as unknown as Keyed<Identity>;
      expect(idOf(record)).toBe("abc");
    });

    it("should write the id under the system key", () => {
      const record = withId<Identity>({identifier: "admin"}, "abc");
      expect(record).toEqual({[key]: "abc", identifier: "admin"});
    });

    it("should replace an existing id", () => {
      const keyed = withId<Identity>({identifier: "admin"}, "abc");
      expect(idOf(withId(keyed, "def"))).toBe("def");
    });

    it("should not change the record it writes an id to", () => {
      const record: Identity = {identifier: "admin"};
      withId(record, "abc");
      expect(record).toEqual({identifier: "admin"});
    });

    it("should remove the id and keep the other fields", () => {
      const keyed = withId<Identity>({identifier: "admin", policies: ["p"]}, "abc");
      expect(omitId(keyed)).toEqual({identifier: "admin", policies: ["p"]});
    });

    it("should not change the record it removes the id from", () => {
      const keyed = withId<Identity>({identifier: "admin"}, "abc");
      omitId(keyed);
      expect(idOf(keyed)).toBe("abc");
    });

    it("should write the id into the record itself", () => {
      const record: Identity = {identifier: "admin"};

      expect(assignId(record, "abc")).toBe(record);
      expect(record).toEqual({[key]: "abc", identifier: "admin"});
    });

    it("should remove the id from the record itself", () => {
      const keyed = withId<Identity>({identifier: "admin"}, "abc");

      expect(stripId(keyed)).toBe(keyed);
      expect(keyed).toEqual({identifier: "admin"});
    });

    it("should accept a record that has no id", () => {
      expect(omitId<Identity>({identifier: "admin"})).toEqual({identifier: "admin"});
    });
  });

  it("should leave the other engine's key alone", () => {
    bindIdTypes({systemKeyField: () => "id"} as unknown as IdTypes);
    const record = {ref: "kept", id: "abc", identifier: "admin"} as unknown as Keyed<Identity>;
    expect(idOf(record)).toBe("abc");
    expect(omitId(record)).toEqual({ref: "kept", identifier: "admin"});
  });

  it("should throw when no adapter has bound id types", () => {
    expect(() => systemKeyField()).toThrow("No data adapter is bound");
  });
});
