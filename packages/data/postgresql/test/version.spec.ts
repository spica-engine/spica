import {assertSupportedServerVersion} from "@spica-server/data-postgresql";

describe("assertSupportedServerVersion", () => {
  it.each(["180000", "180001", 190000])("accepts %s", version => {
    expect(() => assertSupportedServerVersion(version)).not.toThrow();
  });

  it.each(["170005", "160000", "", "abc"])("refuses %p", version => {
    expect(() => assertSupportedServerVersion(version)).toThrow(/PostgreSQL 18 or newer/);
  });
});
