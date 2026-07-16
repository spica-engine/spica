import {EnvRelation, Function, ChangeKind, SecretRelation} from "@spica-server/interface-function";
import {ObjectId} from "@spica-devkit/database";
import {deepCopy} from "@spica-server/core-patch";
import {createPlan, refreshPlan, mergePlans} from "@spica-server/function/src/change";

type Fn = Function<EnvRelation.NotResolved, SecretRelation.NotResolved>;

describe("Change", () => {
  const envVarIds = [new ObjectId(), new ObjectId()];
  const secretIds = [new ObjectId(), new ObjectId()];

  let fn: Fn;

  beforeEach(() => {
    fn = {
      _id: "fn_id",
      name: "my_fn",
      env_vars: [],
      secrets: [],
      language: "javascript",
      timeout: 50,
      triggers: {}
    };
  });

  describe("createPlan", () => {
    it("should return an empty plan when neither side is present", () => {
      expect(createPlan(null, null)).toEqual({routing: [], outdate: [], reconcile: []});
    });

    it("should subscribe every active trigger and reconcile on create", () => {
      fn.triggers = {
        default: {active: true, options: {path: "/test"}, type: "http"},
        another: {active: true, options: {collection: "bucket"}, type: "database"}
      };

      expect(createPlan(null, fn)).toEqual({
        routing: [
          {
            kind: ChangeKind.Added,
            options: {path: "/test"},
            type: "http",
            target: {id: "fn_id", handler: "default", name: "my_fn"}
          },
          {
            kind: ChangeKind.Added,
            options: {collection: "bucket"},
            type: "database",
            target: {id: "fn_id", handler: "another", name: "my_fn"}
          }
        ],
        outdate: [],
        reconcile: ["fn_id"]
      });
    });

    it("should unsubscribe, outdate and reconcile on delete", () => {
      fn.triggers = {default: {active: true, options: {path: "/test"}, type: "http"}};

      expect(createPlan(fn, null)).toEqual({
        routing: [
          {
            kind: ChangeKind.Removed,
            options: {path: "/test"},
            type: "http",
            target: {id: "fn_id", handler: "default", name: "my_fn"}
          }
        ],
        outdate: ["fn_id"],
        reconcile: ["fn_id"]
      });
    });

    it("should route only the changed trigger, without outdating, on a trigger edit", () => {
      const previous: Fn = deepCopy(fn);
      previous.triggers = {default: {active: true, options: {path: "/a"}, type: "http"}};
      const current: Fn = deepCopy(previous);
      current.triggers.default.options.path = "/b";

      const plan = createPlan(previous, current);
      expect(plan.outdate).toEqual([]);
      expect(plan.reconcile).toEqual(["fn_id"]);
      expect(plan.routing.map(c => [c.kind, c.target.handler])).toEqual([
        [ChangeKind.Updated, "default"]
      ]);
    });

    it("should split inserted / updated / removed triggers on update", () => {
      const previous: Fn = deepCopy(fn);
      previous.triggers = {
        removed: {active: true, options: {collection: "test"}, type: "database"},
        updated: {active: true, options: {}, type: "http"},
        deactivated: {active: true, options: {name: "READY"}, type: "system"}
      };
      const current: Fn = deepCopy(previous);
      current.triggers = {
        inserted: {active: true, options: {path: "test"}, type: "http"},
        updated: {active: true, options: {preflight: true}, type: "http"},
        deactivated: {active: false, options: {name: "READY"}, type: "system"}
      };

      const byKind = (kind: ChangeKind) =>
        createPlan(previous, current)
          .routing.filter(c => c.kind == kind)
          .map(c => c.target.handler);

      expect(byKind(ChangeKind.Added)).toEqual(["inserted"]);
      expect(byKind(ChangeKind.Updated)).toEqual(["updated"]);
      expect(byKind(ChangeKind.Removed)).toEqual(["deactivated", "removed"]);
    });

    describe("without triggers", () => {
      const withoutTriggers = (): Fn => {
        const helper: Fn = deepCopy(fn);
        delete helper.triggers;
        return helper;
      };

      it("should reconcile without routing when a helper function is created", () => {
        expect(createPlan(null, withoutTriggers())).toEqual({
          routing: [],
          outdate: [],
          reconcile: ["fn_id"]
        });
      });

      it("should outdate and reconcile without routing when a helper function is deleted", () => {
        expect(createPlan(withoutTriggers(), null)).toEqual({
          routing: [],
          outdate: ["fn_id"],
          reconcile: ["fn_id"]
        });
      });

      it("should not route anything when both sides have no triggers", () => {
        const previous = withoutTriggers();
        const current = withoutTriggers();
        current.timeout = previous.timeout + 10;

        expect(createPlan(previous, current)).toEqual({
          routing: [],
          outdate: ["fn_id"],
          reconcile: ["fn_id"]
        });
      });

      it("should remove existing triggers when a function loses all of them", () => {
        const previous: Fn = deepCopy(fn);
        previous.triggers = {default: {active: true, options: {path: "/a"}, type: "http"}};
        const current = withoutTriggers();

        const plan = createPlan(previous, current);
        expect(plan.routing).toEqual([
          {
            kind: ChangeKind.Removed,
            options: {path: "/a"},
            type: "http",
            target: {id: "fn_id", handler: "default", name: "my_fn"}
          }
        ]);
      });

      it("should subscribe triggers added to a previously helper-only function", () => {
        const previous = withoutTriggers();
        const current: Fn = deepCopy(fn);
        current.triggers = {default: {active: true, options: {path: "/a"}, type: "http"}};

        const plan = createPlan(previous, current);
        expect(plan.routing).toEqual([
          {
            kind: ChangeKind.Added,
            options: {path: "/a"},
            type: "http",
            target: {id: "fn_id", handler: "default", name: "my_fn"}
          }
        ]);
      });
    });

    describe("context refresh (outdate) detection", () => {
      let previous: Fn;
      beforeEach(() => {
        previous = deepCopy(fn);
        previous.env_vars = deepCopy(envVarIds);
        previous.secrets = deepCopy(secretIds);
      });

      const outdatesFor = (mutate: (curr: Fn) => void) => {
        const current: Fn = deepCopy(previous);
        mutate(current);
        return createPlan(previous, current).outdate;
      };

      it("should outdate when an env var is injected/ejected", () => {
        expect(outdatesFor(c => (c.env_vars = [envVarIds[0]]))).toEqual(["fn_id"]);
      });

      it("should outdate when a secret is injected/ejected", () => {
        expect(outdatesFor(c => (c.secrets = [secretIds[0]]))).toEqual(["fn_id"]);
      });

      it("should outdate when the timeout changes", () => {
        expect(outdatesFor(c => (c.timeout = previous.timeout + 10))).toEqual(["fn_id"]);
      });

      it("should NOT outdate for warmWorkers (reconcile-only)", () => {
        expect(outdatesFor(c => (c.warmWorkers = 3))).toEqual([]);
      });

      it("should NOT outdate for concurrencyPerWorker (reconcile-only)", () => {
        expect(outdatesFor(c => (c.concurrencyPerWorker = 4))).toEqual([]);
      });

      it("should NOT outdate when nothing context-relevant changed", () => {
        expect(outdatesFor(() => {})).toEqual([]);
      });
    });
  });

  describe("refreshPlan", () => {
    it("should outdate and reconcile a single function without routing", () => {
      expect(refreshPlan("fn_id")).toEqual({
        routing: [],
        outdate: ["fn_id"],
        reconcile: ["fn_id"]
      });
    });
  });

  describe("mergePlans", () => {
    it("should concat routing and union outdate/reconcile", () => {
      const a = refreshPlan("a");
      const b = createPlan(null, {...fn, _id: "b", triggers: {h: {active: true, options: {}, type: "http"}}});
      const c = refreshPlan("a"); // duplicate id

      expect(mergePlans([a, b, c])).toEqual({
        routing: b.routing,
        outdate: ["a"],
        reconcile: ["a", "b"]
      });
    });
  });
});
