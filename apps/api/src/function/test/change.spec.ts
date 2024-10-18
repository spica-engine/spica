import {Function} from "@spica-server/interface/function";
import {
  ChangeKind,
  createTargetChanges,
  changesFromTriggers
} from "@spica-server/function/src/change";

describe("Change", () => {
  let fn: Function;

  beforeEach(() => {
    fn = {
      _id: "fn_id",
      name: "my_fn",
      env: {test: "123"},
      language: "javascript",
      timeout: 50,
      triggers: {}
    };
  });

  it("should create target changes from given parameters", () => {
    fn.triggers = {
      default: {
        active: true,
        options: {
          path: "/test"
        },
        type: "http"
      },
      another: {
        active: true,
        options: {
          collection: "bucket"
        },
        type: "database"
      }
    };

    const changes = createTargetChanges(fn, ChangeKind.Added);
    expect(changes).toEqual([
      {
        kind: ChangeKind.Added,
        options: {
          path: "/test"
        },
        type: "http",
        target: {
          id: "fn_id",
          handler: "default",
          context: {
            env: {test: "123"},
            timeout: 50
          }
        }
      },
      {
        kind: ChangeKind.Added,
        options: {
          collection: "bucket"
        },
        type: "database",
        target: {
          id: "fn_id",
          handler: "another",
          context: {
            env: {test: "123"},
            timeout: 50
          }
        }
      }
    ]);
  });

  it("should create trigger changes", () => {
    const insertedTrigger = {
      inserted: {
        type: "http",
        active: true,
        options: {
          path: "test"
        }
      }
    };

    //it should not be a part of inserted handlers
    const deactiveInsertedTrigger = {
      deactive_inserted: {
        type: "http",
        active: false,
        options: {
          path: "path"
        }
      }
    };

    const removedTrigger = {
      removed: {
        type: "database",
        active: true,
        options: {
          collection: "test"
        }
      }
    };

    //trigger configuration will be updated. It should be a part of updated handlers
    let updatedTrigger = {
      updated: {
        type: "http",
        active: true,
        options: {}
      }
    };

    //active status will be updated. It should be a part of removed handlers
    let deactivatedTrigger = {
      deactivated: {
        type: "system",
        active: true,
        options: {
          name: "READY"
        }
      }
    };

    const unchangedTrigger = {
      unchanged: {
        options: {
          frequency: "* * * * *"
        },
        type: "schedule",
        active: true
      }
    };

    const previousFn = JSON.parse(
      JSON.stringify({
        ...fn,
        triggers: {
          ...removedTrigger,
          ...updatedTrigger,
          ...deactivatedTrigger,
          ...unchangedTrigger
        }
      })
    );

    let currentFn = {
      ...fn,
      triggers: {
        ...insertedTrigger,
        ...deactiveInsertedTrigger,
        ...updatedTrigger,
        ...deactivatedTrigger,
        ...unchangedTrigger
      }
    };

    currentFn.triggers.updated.options["preflight"] = true;
    currentFn.triggers.deactivated.active = false;

    //for making more readable
    const changes = changesFromTriggers(previousFn, currentFn);

    const insertedHandlers = changes
      .filter(change => change.kind == ChangeKind.Added)
      .map(change => change.target.handler);

    const updatedHandlers = changes
      .filter(change => change.kind == ChangeKind.Updated)
      .map(change => change.target.handler);

    const removedHandlers = changes
      .filter(change => change.kind == ChangeKind.Removed)
      .map(change => change.target.handler);

    expect(insertedHandlers).toEqual(["inserted"]);
    expect(updatedHandlers).toEqual(["updated"]);
    expect(removedHandlers).toEqual(["deactivated", "removed"]);
  });
});
