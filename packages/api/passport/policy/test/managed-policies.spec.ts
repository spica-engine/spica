import {bindIdTypes} from "@spica-server/data";
import {IdTypes} from "@spica-server/interface-data";
import {PolicyService} from "../src/policy.service";

describe("managed policies", () => {
  afterEach(() => bindIdTypes(undefined as IdTypes));

  it.each(["key", "id"])("should carry their name under the system key %s", key => {
    bindIdTypes({systemKeyField: () => key} as unknown as IdTypes);
    const service = new PolicyService({} as any);

    const keyed = service.managedPolicies.map(policy => policy[key]);

    expect(keyed).toContain("ActivityFullAccess");
    expect(keyed).toContain("StatusFullAccess");
    expect(new Set(keyed).size).toBe(keyed.length);
    expect(keyed.every(id => typeof id == "string")).toBe(true);
  });

  it("should be flagged as system policies and keep their content", () => {
    bindIdTypes({systemKeyField: () => "id"} as unknown as IdTypes);
    const service = new PolicyService({} as any);

    const status = service.managedPolicies.find(policy => policy["id"] == "StatusFullAccess");

    expect(status).toMatchObject({
      name: "Status Full Access",
      system: true,
      statement: [{action: "status:index"}, {action: "status:show"}]
    });
  });

  it("should build the list once", () => {
    bindIdTypes({systemKeyField: () => "id"} as unknown as IdTypes);
    const service = new PolicyService({} as any);

    expect(service.managedPolicies).toBe(service.managedPolicies);
  });
});
