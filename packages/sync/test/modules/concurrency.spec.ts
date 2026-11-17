import {
  applyPlan,
  bucketModule,
  buildPlan,
  ChangeKind,
  envVarModule,
  functionModule,
  memorySource,
  Plan,
  PlanEntry,
  policyModule,
  ResourceModule,
  secretModule
} from "@spica-server/sync";
import {createTrackingHttp} from "../helpers/tracking-http";

function planOf(mod: ResourceModule, entries: Partial<PlanEntry>[], kind: ChangeKind): Plan {
  const full = entries.map(e => ({summary: "", changedFields: [], diffs: {}, kind, ...e}));
  return {
    modules: [
      {
        module: mod,
        creates: kind === ChangeKind.Create ? (full as PlanEntry[]) : [],
        updates: kind === ChangeKind.Update ? (full as PlanEntry[]) : [],
        deletes: []
      }
    ]
  };
}

describe("function module", () => {
  it("reads every function with at most `concurrency` requests in flight", async () => {
    const functions = Array.from({length: 12}, (_, i) => ({id: `id${i}`, name: `fn${i}`}));
    const tracking = createTrackingHttp((_, url) => {
      if (url === "function") return functions;
      return url.endsWith("/index") ? {index: "export default () => {}"} : [];
    });

    const plan = await buildPlan([functionModule], tracking, "", {
      concurrency: 3,
      source: memorySource({})
    });

    expect(plan.modules[0].deletes).toHaveLength(12);
    expect(tracking.calls).toHaveLength(1 + 12 * 2);
    expect(tracking.peak).toBe(3);
  });

  it("applies updates that attach env vars and secrets within the request limit", async () => {
    const tracking = createTrackingHttp((_, url) => (url.endsWith("/dependencies") ? [] : {}));
    const entries = Array.from({length: 4}, (_, i) => ({
      slug: `fn${i}`,
      local: {
        slug: `fn${i}`,
        data: {
          schema: {
            name: `fn${i}`,
            env_vars: ["e1", "e2", "e3"],
            secrets: ["s1", "s2", "s3"]
          },
          index: "export default () => {}",
          dependencies: {}
        }
      },
      remote: {slug: `fn${i}`, id: `id${i}`, data: {} as any}
    }));

    const {errors} = await applyPlan(planOf(functionModule, entries, ChangeKind.Update), tracking, {
      concurrency: 2
    });

    const attachments = tracking.calls.filter(c => /\/(env-var|secret)\//.test(c.url));
    expect(errors).toEqual([]);
    expect(attachments).toHaveLength(4 * 6);
    expect(tracking.peak).toBe(2);
  });
});

describe.each([
  ["bucket", bucketModule, "bucket"],
  ["env-var", envVarModule, "env-var"],
  ["secret", secretModule, "secret"],
  ["policy", policyModule, "passport/policy"]
] as const)("%s module", (_name, mod, endpoint) => {
  it("creates resources within the request limit", async () => {
    const tracking = createTrackingHttp();
    const entries = Array.from({length: 8}, (_, i) => ({
      slug: `r${i}`,
      local: {slug: `r${i}`, data: {title: `r${i}`, key: `r${i}`, name: `r${i}`}}
    }));

    const {errors} = await applyPlan(planOf(mod, entries, ChangeKind.Create), tracking, {
      concurrency: 3
    });

    expect(errors).toEqual([]);
    expect(tracking.calls.filter(c => c.method === "post" && c.url === endpoint)).toHaveLength(8);
    expect(tracking.peak).toBe(3);
  });
});
