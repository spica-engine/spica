import {PostgresDataAdapter} from "@spica-server/data-postgresql";

describe("PostgresDataAdapter", () => {
  it("should declare that an unset optional property is a NULL column", () => {
    const adapter = PostgresDataAdapter.forRoot("postgres://localhost/spica");

    expect(adapter.capabilities).toEqual({nullableProperties: true});
  });
});
