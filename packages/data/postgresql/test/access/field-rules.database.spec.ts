import {usePostgresAccessStore} from "../contract/access-store";

describe("field level rules against rows in PostgreSQL", () => {
  const store = usePostgresAccessStore();

  /*
   * ann and bob have an author; ann's author is senior. cem has nothing, and dee has an age but no
   * author.
   */
  beforeAll(async () => {
    await store.reset();
    await store.insert({senior: {level: 3}, junior: {level: 1}}, "other");
    await store.insert({
      ann: {age: 30, author: "senior"},
      bob: {age: 20, author: "junior"},
      cem: {},
      dee: {age: 25}
    });
  });

  const rules = {
    title: "document.age > 24",
    count: "auth.role == 'admin'",
    big: "document.author.level > 1",
    owner: "false==true"
  };

  it("should hide a field from the rows its rule does not hold for", async () => {
    const hidden = await store.hiddenFields(rules, {role: "admin"});

    expect(hidden).toEqual({
      ann: ["owner"],
      bob: ["big", "owner", "title"],
      cem: ["big", "owner", "title"],
      dee: ["big", "owner"]
    });
  });

  it("should hide a field from every row when the caller is not allowed to see it", async () => {
    const hidden = await store.hiddenFields(rules, {role: "user"});

    expect(hidden).toEqual({
      ann: ["count", "owner"],
      bob: ["big", "count", "owner", "title"],
      cem: ["big", "count", "owner", "title"],
      dee: ["big", "count", "owner"]
    });
  });

  it("should hide nothing when every rule holds", async () => {
    const hidden = await store.hiddenFields(
      {title: "true==true", count: "auth.role == 'admin'"},
      {
        role: "admin"
      }
    );

    expect(hidden).toEqual({ann: [], bob: [], cem: [], dee: []});
  });

  it("should hide a field from the rows where the rule has no answer", async () => {
    const hidden = await store.hiddenFields({title: "document.age > 24"});

    expect(hidden).toEqual({ann: [], bob: ["title"], cem: ["title"], dee: []});
  });
});
