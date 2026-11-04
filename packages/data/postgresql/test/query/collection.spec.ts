import {BadRequestException} from "@nestjs/common";
import {
  identities,
  InvalidRuleError,
  secrets,
  storageObjects,
  UnsupportedRuleError,
  users
} from "@spica-server/data-postgresql";
import {orderBy, projection} from "../../src/query/collection/plan";
import {relationsOf} from "../../src/query/collection/relations";
import {EntityFieldResolver} from "../../src/query/collection/resolver";
import {expectSql} from "../access/sql";

const none = relationsOf("env_var");

describe("EntityFieldResolver", () => {
  const resolver = (entity = storageObjects) => new EntityFieldResolver(entity, "t");

  it("should name a column by the property the document uses", () => {
    expect(resolver().locate(["name"])).toMatchObject({
      kind: "column",
      sql: `"t"."name"`,
      type: "text"
    });
    expect(resolver().locate(["content", "size"])).toMatchObject({
      sql: `"t"."content_size"`,
      type: "double precision"
    });
    expect(resolver().locate(["_id"])).toMatchObject({sql: `"t"."id"`, type: "uuid"});
  });

  it("should refuse a property the collection does not have", () => {
    expect(() => resolver().locate(["nope"])).toThrow(InvalidRuleError);
    expect(() => resolver().locate(["content"])).toThrow(InvalidRuleError);
  });

  it.each([
    ["password", identities],
    ["authFactor.secret", identities],
    ["lastPasswords", users],
    ["email.encrypted", users],
    ["value.encrypted", secrets]
  ])("should not let a filter read %s", (property, entity) => {
    expect(() => resolver(entity).locate(property.split("."))).toThrow(UnsupportedRuleError);
  });

  it("should refuse a list column", () => {
    expect(() => resolver(identities).locate(["policies"])).toThrow(UnsupportedRuleError);
  });
});

describe("orderBy", () => {
  it("should end with the id so paging is stable", () => {
    expectSql(orderBy(storageObjects, none), `"t"."id" ASC`);
    expectSql(
      orderBy(storageObjects, none, {"content.size": -1, name: 1}),
      `"t"."content_size" DESC NULLS LAST, "t"."name" ASC NULLS FIRST, "t"."id" ASC`
    );
  });

  it("should not repeat the id", () => {
    expectSql(orderBy(storageObjects, none, {_id: -1}), `"t"."id" DESC NULLS LAST`);
  });

  it.each([["nope"], ["content"]])("should refuse to sort by %s", field => {
    expect(() => orderBy(storageObjects, none, {[field]: 1})).toThrow(BadRequestException);
  });

  it("should not let anybody sort by a secret", () => {
    expect(() => orderBy(secrets, none, {"value.encrypted": 1})).toThrow(BadRequestException);
  });
});

describe("projection", () => {
  const columns = (sql: string) => sql.split(", ").map(part => part.replace(/ AS .*/, ""));

  it("should select everything by default", () => {
    expect(columns(projection(storageObjects, none)).length).toBe(storageObjects.columns.length);
  });

  it("should leave out the columns of a group, or of one property", () => {
    const sql = projection(storageObjects, none, {content: 0, url: 0});
    expect(sql).not.toContain("content_size");
    expect(sql).not.toContain('"url"');
    expect(sql).toContain('"t"."name"');
  });

  it("should keep only what is asked for, and the id unless it is switched off", () => {
    expect(columns(projection(storageObjects, none, {name: 1}))).toEqual([
      `"t"."id"`,
      `"t"."name"`
    ]);
    expect(columns(projection(storageObjects, none, {name: 1, _id: 0}))).toEqual([`"t"."name"`]);
    expect(columns(projection(storageObjects, none, {content: 1})).sort()).toEqual([
      `"t"."content_size"`,
      `"t"."content_type"`,
      `"t"."id"`
    ]);
  });

  it("should never select nothing", () => {
    expect(columns(projection(storageObjects, none, {nope: 1, _id: 0}))).toEqual([`"t"."id"`]);
  });
});

describe("relationsOf", () => {
  it("should know the relations of the collections that have them", () => {
    expect(relationsOf("activity", ["identifier", "username"]).joined).toHaveLength(2);
    expect(relationsOf("function", ["env_vars", "secrets"]).resolved).toHaveLength(2);
    expect(relationsOf("function_logs", ["function"]).resolved).toHaveLength(1);
  });

  it("should refuse a relation a collection does not have", () => {
    expect(() => relationsOf("env_var", ["nope"])).toThrow("has no relation named nope");
    expect(() => relationsOf("activity", ["env_vars"])).toThrow(Error);
  });
});
