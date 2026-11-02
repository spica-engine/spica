import {
  assertUnique,
  columnName,
  constraintName,
  fieldTableName,
  fit,
  mainTableName,
  MAX_IDENTIFIER_BYTES,
  BucketSchemaError
} from "@spica-server/data-postgresql";

describe("naming", () => {
  const bucketId = "0198a7e0-7b1c-7d2e-9f3a-4b5c6d7e8f90";

  describe("fit", () => {
    it("should keep a name that fits", () => {
      const name = "a".repeat(MAX_IDENTIFIER_BYTES);
      expect(fit(name)).toBe(name);
    });

    it("should shorten a longer name to exactly the limit and keep its readable start", () => {
      const name = "customer_shipping_address_" + "x".repeat(60);
      const fitted = fit(name);

      expect(Buffer.byteLength(fitted)).toBe(MAX_IDENTIFIER_BYTES);
      expect(fitted.startsWith("customer_shipping_address_xxxx")).toBe(true);
    });

    it("should be stable and tell apart names that only differ past the cut", () => {
      const shared = "a".repeat(70);

      expect(fit(`${shared}1`)).toBe(fit(`${shared}1`));
      expect(fit(`${shared}1`)).not.toBe(fit(`${shared}2`));
    });

    it("should not split a multibyte character", () => {
      const fitted = fit("ç".repeat(60));

      expect(Buffer.byteLength(fitted)).toBeLessThanOrEqual(MAX_IDENTIFIER_BYTES);
      expect(fitted).not.toContain("�");
    });

    it("should keep every name of random fields within the limit and unique", () => {
      const names = new Set<string>();
      for (let length = 1; length <= 200; length++) {
        const logical = `field${"_ab".repeat(length)}`;
        const fitted = fit(logical);
        expect(Buffer.byteLength(fitted)).toBeLessThanOrEqual(MAX_IDENTIFIER_BYTES);
        names.add(fitted);
      }
      expect(names.size).toBe(200);
    });
  });

  it("should name the main table after the bucket", () => {
    expect(mainTableName(bucketId)).toBe(`bucket_${bucketId}`);
    expect(Buffer.byteLength(mainTableName(bucketId))).toBe(43);
  });

  it("should name columns after their path", () => {
    expect(columnName(["title"])).toBe("title");
    expect(columnName(["address", "city"])).toBe("address__city");
  });

  it("should name child and link tables after the main table and the field path", () => {
    expect(fieldTableName(bucketId, ["tags"])).toBe(`bucket_${bucketId}__tags`);
    expect(Buffer.byteLength(fieldTableName(bucketId, ["shipping_addresses", "lines"]))).toBe(
      MAX_IDENTIFIER_BYTES
    );
  });

  it("should name constraints after the table, the columns and the kind", () => {
    expect(constraintName("t", ["a", "b"], "uq")).toBe("t_a_b_uq");
    expect(constraintName(mainTableName(bucketId), ["email"], "ix")).toBe(
      `bucket_${bucketId}_email_ix`
    );
    expect(
      Buffer.byteLength(constraintName(mainTableName(bucketId), ["customer_billing_email"], "ix"))
    ).toBe(MAX_IDENTIFIER_BYTES);
  });

  describe("assertUnique", () => {
    it("should accept distinct names and equal names in different scopes", () => {
      expect(() =>
        assertUnique([
          {scope: "a", name: "x", logical: "x"},
          {scope: "a", name: "y", logical: "y"},
          {scope: "b", name: "x", logical: "x"}
        ])
      ).not.toThrow();
    });

    it("should name every pair that collides", () => {
      const error = (() => {
        try {
          assertUnique([
            {scope: 'table "t"', name: "a__b", logical: "a__b"},
            {scope: 'table "t"', name: "a__b", logical: "a.b"}
          ]);
        } catch (e) {
          return e;
        }
      })();

      expect(error).toBeInstanceOf(BucketSchemaError);
      expect(error.problems).toEqual(['"a__b" and "a.b" both map to "a__b" in table "t".']);
    });
  });
});
