import {EnvRelation, Function, ChangeKind, SecretRelation} from "@spica-server/interface/function";
import {ObjectId} from "@spica-devkit/database";
import {EnvVar} from "@spica-server/interface/env_var";
import {deepCopy} from "@spica-server/core/patch";
import {
  createTargetChanges,
  changesFromTriggers,
  hasContextChange
} from "@spica-server/function/src/change";
import {Secret} from "@spica-server/interface/secret";

describe("Change", () => {
  let fn: Function<EnvRelation.Resolved, SecretRelation.Resolved>;
  const envVarIds = [new ObjectId(), new ObjectId()];
  const secretIds = [new ObjectId(), new ObjectId()];

  let envVars: EnvVar[] = [
    {
      _id: envVarIds[0],
      key: "IGNORE_ERRORS",
      value: "true"
    },
    {
      _id: envVarIds[1],
      key: "SOMETHING_SECRET",
      value: "91kd209k1"
    }
  ];

  let secrets: Secret[] = [
    {
      _id: secretIds[0],
      key: "DB_PASSWORD",
      value: {encrypted: "enc1", iv: "iv1", authTag: "tag1"}
    },
    {
      _id: secretIds[1],
      key: "API_TOKEN",
      value: {encrypted: "enc2", iv: "iv2", authTag: "tag2"}
    }
  ];

  const secretDecryptor = (secret: Secret) => ({
    _id: secret._id,
    key: secret.key,
    value: `decrypted_${secret.key}`
  });

  beforeEach(() => {
    fn = {
      _id: "fn_id",
      name: "my_fn",
      env_vars: envVars,
      secrets: secrets,
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

    const changes = createTargetChanges(fn, ChangeKind.Added, secretDecryptor);
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
          name: "my_fn",
          context: {
            env: {
              IGNORE_ERRORS: "true",
              SOMETHING_SECRET: "91kd209k1",
              DB_PASSWORD: "decrypted_DB_PASSWORD",
              API_TOKEN: "decrypted_API_TOKEN"
            },
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
          name: "my_fn",
          context: {
            env: {
              IGNORE_ERRORS: "true",
              SOMETHING_SECRET: "91kd209k1",
              DB_PASSWORD: "decrypted_DB_PASSWORD",
              API_TOKEN: "decrypted_API_TOKEN"
            },
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

    const changes = changesFromTriggers(previousFn, currentFn, secretDecryptor);

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

  it("should detect environment variable on ejected", () => {
    const previousFn: Function<EnvRelation.NotResolved> = deepCopy(fn);
    previousFn.env_vars = envVarIds;

    const currentFn: Function<EnvRelation.NotResolved> = deepCopy(previousFn);
    currentFn.env_vars = [envVarIds[0]];

    const hasContextChanges = hasContextChange(previousFn, currentFn);
    expect(hasContextChanges).toBe(true);
  });

  it("should detect environment variable on injected", () => {
    const previousFn: Function<EnvRelation.NotResolved> = deepCopy(fn);
    previousFn.env_vars = [envVarIds[0]];

    const currentFn: Function<EnvRelation.NotResolved> = deepCopy(previousFn);
    currentFn.env_vars = envVarIds;

    const hasContextChanges = hasContextChange(previousFn, currentFn);
    expect(hasContextChanges).toBe(true);
  });

  it("should not detect anything if environment variables are same", () => {
    const previousFn: Function<EnvRelation.NotResolved> = deepCopy(fn);
    const currentFn: Function<EnvRelation.NotResolved> = deepCopy(previousFn);

    const hasContextChanges = hasContextChange(previousFn, currentFn);
    expect(hasContextChanges).toBe(false);
  });

  it("should detect secret on ejected", () => {
    const previousFn: Function<EnvRelation.NotResolved, SecretRelation.NotResolved> = deepCopy(fn);
    previousFn.secrets = deepCopy(secretIds);

    const currentFn: Function<EnvRelation.NotResolved, SecretRelation.NotResolved> =
      deepCopy(previousFn);
    currentFn.secrets = [deepCopy(secretIds[0])];

    const hasContextChanges = hasContextChange(previousFn, currentFn);
    expect(hasContextChanges).toBe(true);
  });

  it("should detect secret on injected", () => {
    const previousFn: Function<EnvRelation.NotResolved, SecretRelation.NotResolved> = deepCopy(fn);
    previousFn.secrets = [deepCopy(secretIds[0])];

    const currentFn: Function<EnvRelation.NotResolved, SecretRelation.NotResolved> =
      deepCopy(previousFn);
    currentFn.secrets = deepCopy(secretIds);

    const hasContextChanges = hasContextChange(previousFn, currentFn);
    expect(hasContextChanges).toBe(true);
  });

  it("should not detect anything if secrets are same", () => {
    const previousFn: Function<EnvRelation.NotResolved, SecretRelation.NotResolved> = deepCopy(fn);
    previousFn.secrets = deepCopy(secretIds);
    const currentFn: Function<EnvRelation.NotResolved, SecretRelation.NotResolved> =
      deepCopy(previousFn);

    const hasContextChanges = hasContextChange(previousFn, currentFn);
    expect(hasContextChanges).toBe(false);
  });

  it("should detect timeout changes", () => {
    const previousFn: Function<EnvRelation.NotResolved> = deepCopy(fn);
    const currentFn: Function<EnvRelation.NotResolved> = deepCopy(previousFn);
    currentFn.timeout = previousFn.timeout + 10;

    const hasContextChanges = hasContextChange(previousFn, currentFn);
    expect(hasContextChanges).toBe(true);
  });
});
