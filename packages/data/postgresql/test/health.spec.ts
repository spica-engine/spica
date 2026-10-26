import {PostgresDataHealth} from "@spica-server/data-postgresql";

describe("PostgresDataHealth", () => {
  it("pings through the pool", async () => {
    const query = jest.fn().mockResolvedValue({rows: []});
    await new PostgresDataHealth({query} as any).ping();
    expect(query).toHaveBeenCalledWith("SELECT 1");
  });

  it("rejects when the pool can not serve queries", async () => {
    const query = jest.fn().mockRejectedValue(new Error("down"));
    await expect(new PostgresDataHealth({query} as any).ping()).rejects.toThrow("down");
  });
});
