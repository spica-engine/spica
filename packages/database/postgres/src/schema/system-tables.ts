import {ColumnSpec, TableSpec} from "@spica-server/database-driver";
import {Bucket} from "@spica-server/interface-bucket";
import {bucketToTable} from "./bucket-to-table.js";
import {SYSTEM_SCHEMA} from "./naming.js";

/**
 * The schemas of the system collections.
 *
 * They are written in the **bucket vocabulary** (`string`, `number`, `date`, `array`, `json`, …) so that one
 * definition yields both the `TableSpec` and the row↔document codec; a separate path for system tables would
 * be two code paths drifting apart.
 *
 * The shapes are known at compile time, so the fields are real columns rather than one free `jsonb` — only
 * the genuinely open-ended part of a collection such as `preferences` goes into a json column.
 */
interface SystemTableDefinition {
  name: string;
  properties: Record<string, unknown>;
  /** When the primary key is not an ObjectId. See `TableSpec.idKind`. */
  idKind?: "objectId" | "text";
  /**
   * The `json` columns whose key order is **meaningful**; `json` is used instead of `jsonb`. The rationale
   * is in `ColumnSpec.orderedJson`.
   */
  orderedJson?: string[];
}

const DEFINITIONS: SystemTableDefinition[] = [
  {
    // `bucket.service.ts` — the bucket definitions themselves. K-12: the intent is here, the table is the derivative.
    name: "buckets",
    /**
     * `properties` is **ordered**: the panel's field order is this object's key order, and `jsonb` would
     * sort the keys.
     */
    orderedJson: ["properties"],
    properties: {
      title: {type: "string"},
      description: {type: "string"},
      icon: {type: "string"},
      primary: {type: "string"},
      order: {type: "number"},
      required: {type: "array", items: {type: "string"}},
      readOnly: {type: "boolean"},
      history: {type: "boolean"},
      // Open-ended and nested: the property map, the acl, the indexes, the language settings.
      properties: {type: "json"},
      acl: {type: "json"},
      indexes: {type: "json"},
      documentSettings: {type: "json"},
      category: {type: "string"}
    }
  },
  {
    // `Preference` is `{_id, scope, [key: string]: any}`: the extra fields are at the **top level**.
    name: "preferences",
    properties: {
      scope: {type: "string"}
    }
  },
  {
    /**
     * `Identity` is a closed interface, but the fields a tenant adds from the panel are stored at the **top
     * level** without appearing in it, so they land in the overflow column.
     */
    name: "identity",
    properties: {
      identifier: {type: "string"},
      password: {type: "string"},
      deactivateJwtsBefore: {type: "number"},
      policies: {type: "array", items: {type: "string"}},
      authFactor: {type: "json"},
      lastPasswords: {type: "array", items: {type: "string"}},
      lastLogin: {type: "date"},
      failedAttempts: {type: "array", items: {type: "date"}}
    }
  },
  {
    /**
     * `User` uses **`username`**, not `identifier` as `identity` does. `email`/`phone` are
     * `EncryptedData<true>`, so objects with unique indexes on their nested `hash` paths.
     */
    name: "user",
    properties: {
      username: {type: "string"},
      password: {type: "string"},
      deactivateJwtsBefore: {type: "number"},
      policies: {type: "array", items: {type: "string"}},
      authFactor: {type: "json"},
      lastPasswords: {type: "array", items: {type: "string"}},
      lastLogin: {type: "date"},
      failedAttempts: {type: "array", items: {type: "date"}},
      bannedUntil: {type: "date"},
      email: {type: "json"},
      email_verified_at: {type: "date"},
      phone: {type: "json"},
      phone_verified_at: {type: "date"}
    }
  },
  {
    /**
     * The fields come from `UserVerification`. `userId` carries an id but takes no foreign key: the target
     * can be `identity` **or** `user`.
     */
    name: "verification",
    properties: {
      /**
       * A targetless `relation`: `char(24)` plus the codec's id conversion and no foreign key. Declaring it
       * `string` would read the `ObjectId` back as a hex string and the caller's comparison would fail.
       */
      userId: {type: "relation", relationType: "onetoone"},
      destination: {type: "string"},
      attempts: {type: "number"},
      requestCount: {type: "number"},
      code: {type: "string"},
      strategy: {type: "string"},
      provider: {type: "string"},
      purpose: {type: "string"},
      is_used: {type: "boolean"},
      /**
       * Kept **only for records already written under that name**: the service now writes `created_at`, the
       * field `upsertTTLIndex` is hard-wired to. Dropping the column would lose those rows' timestamps, and
       * the TTL does not see them anyway.
       */
      createdAt: {type: "date"},
      created_at: {type: "date"}
    }
  },
  {
    name: "refresh_token",
    properties: {
      identity: {type: "string"},
      user: {type: "string"},
      token: {type: "string"},
      created_at: {type: "date"},
      expired_at: {type: "date"},
      last_used_at: {type: "date"},
      disabled: {type: "boolean"}
    }
  },
  {
    name: "apikey",
    properties: {
      key: {type: "string"},
      name: {type: "string"},
      description: {type: "string"},
      policies: {type: "array", items: {type: "string"}},
      active: {type: "boolean"}
    }
  },
  {
    name: "policies",
    properties: {
      name: {type: "string"},
      description: {type: "string"},
      // `statement` is a nested array; the schemaless part.
      statement: {type: "json"}
    }
  },
  {
    // `Strategy` carries `[index: string]: any`; undeclared fields land in the overflow column.
    name: "strategy",
    properties: {
      type: {type: "string"},
      name: {type: "string"},
      title: {type: "string"},
      icon: {type: "string"},
      options: {type: "json"}
    }
  },
  {
    name: "activity",
    properties: {
      action: {type: "number"},
      identifier: {type: "string"},
      username: {type: "string"},
      resource: {type: "array", items: {type: "string"}},
      created_at: {type: "date"}
    }
  },
  {
    name: "status",
    properties: {
      count: {type: "number"},
      request: {type: "json"},
      response: {type: "json"},
      created_at: {type: "date"}
    }
  },
  {
    name: "function_logs",
    properties: {
      function: {type: "string"},
      event_id: {type: "string"},
      content: {type: "string"},
      // `LogChannels` is a **string** enum, `LogLevels` a **numeric** one: as `text`, `level` reads back as
      // `"4"` and the controller's `{$in: levels}` of numbers matches nothing.
      channel: {type: "string"},
      level: {type: "number"},
      created_at: {type: "date"}
    }
  },
  {
    name: "webhook",
    properties: {
      title: {type: "string"},
      url: {type: "string"},
      body: {type: "string"},
      trigger: {type: "json"}
    }
  },
  {
    /** `Log` carries `request`/`response` **under `content`**, not at the top level. */
    name: "webhook_logs",
    properties: {
      webhook: {type: "string"},
      succeed: {type: "boolean"},
      content: {type: "json"},
      created_at: {type: "date"}
    }
  },
  {
    name: "function",
    properties: {
      name: {type: "string"},
      description: {type: "string"},
      language: {type: "string"},
      timeout: {type: "number"},
      triggers: {type: "json"},
      /** `env_vars` and `secrets` are `ObjectId[]`, stored as hex strings in a native `text[]` column. */
      env_vars: {type: "array", items: {type: "string"}},
      secrets: {type: "array", items: {type: "string"}},
      warmWorkers: {type: "number"},
      concurrencyPerWorker: {type: "number"},
      order: {type: "number"}
    }
  },
  {
    name: "env_var",
    properties: {
      key: {type: "string"},
      value: {type: "string"},
      updated_at: {type: "date"}
    }
  },
  {
    // `Secret.value` is `EncryptedData<false>` — an encrypted **object**, not text.
    name: "secret",
    properties: {
      key: {type: "string"},
      value: {type: "json"},
      updated_at: {type: "date"}
    }
  },
  {
    name: "dashboard",
    properties: {
      name: {type: "string"},
      icon: {type: "string"},
      components: {type: "json"}
    }
  },
  {
    name: "asset",
    properties: {
      name: {type: "string"},
      description: {type: "string"},
      resources: {type: "json"},
      status: {type: "string"},
      url: {type: "string"},
      icon: {type: "string"},
      configs: {type: "json"}
    }
  },
  {
    /** `url` is **deliberately absent**: it is computed as a signed link on every read, not stored. */
    name: "storage",
    properties: {
      name: {type: "string"},
      // The storage object's content (`content.type`, `content.size`) is nested.
      content: {type: "json"},
      created_at: {type: "date"},
      updated_at: {type: "date"}
    }
  },
  {
    /**
     * `replication` — job handover between pods, swept by TTL.
     *
     * `_id` is **not an ObjectId**: the callers write a change stream resume token or a `uniqid()`, and
     * `char(24)` would raise on a long one and silently blank-pad a short one.
     */
    name: "jobs",
    idKind: "text",
    properties: {
      job: {type: "string"},
      created_at: {type: "date"}
    }
  },
  {
    // `CommandMessage._id` is free text too.
    name: "commands",
    idKind: "text",
    /** The fields come from `CommandMessage` (`{_id?, source, target}`), not from `Command` one level in. */
    properties: {
      source: {type: "json"},
      target: {type: "json"},
      created_at: {type: "date"}
    }
  },
  {
    /** `function_assets` is **separate** from the `asset` module's `asset` table. */
    name: "function_assets",
    properties: {
      /** The fields come from `FunctionAsset`; `filename` is a string union, not json. */
      functionId: {type: "relation", relationType: "onetoone"},
      filename: {type: "string"},
      key: {type: "string"},
      hash: {type: "string"},
      size: {type: "number"},
      uploadDate: {type: "date"},
      strategy: {type: "string"}
    }
  },
  {
    /**
     * `bucket_id`/`document_id` are **targetless `relation`s**: `char(24)` is right, a foreign key is not —
     * `document_id` points at a row of bucket data, whose table varies per bucket.
     */
    name: "history",
    properties: {
      bucket_id: {type: "relation", relationType: "onetoone"},
      document_id: {type: "relation", relationType: "onetoone"},
      title: {type: "string"},
      changes: {type: "json"},
      date: {type: "date"}
    }
  },
  {
    // `config.service.ts` reads `{module, options}` — not `contents`.
    name: "config",
    properties: {
      module: {type: "string"},
      options: {type: "json"}
    }
  }
];

/**
 * The bucket-like schema of a system collection. `_id` is the table name itself, and because `bucketToTable`
 * would turn that into `bucket_<id>`, the `collection` field is corrected afterwards.
 */
export function systemSchema(name: string): Bucket | undefined {
  const definition = DEFINITIONS.find(d => d.name === name);
  if (!definition) return undefined;

  return {
    _id: definition.name as any,
    title: definition.name,
    description: `Spica system collection '${definition.name}'`,
    primary: Object.keys(definition.properties)[0],
    acl: {read: "false==true", write: "false==true"},
    properties: definition.properties
  } as unknown as Bucket;
}

/**
 * The column that collects undeclared fields. It is on **every** system table on purpose: these schemas are
 * hand-written and can be incomplete, and an undeclared field would otherwise disappear silently on write.
 */
export const OVERFLOW_COLUMN = "_extra";

export function systemTable(name: string): TableSpec | undefined {
  const schema = systemSchema(name);
  if (!schema) return undefined;

  const base = bucketToTable(schema);
  const definition = DEFINITIONS.find(d => d.name === name)!;
  return {
    ...base,
    collection: name,
    namespace: SYSTEM_SCHEMA,
    overflowColumn: OVERFLOW_COLUMN,
    idKind: definition.idKind || "objectId",
    columns: [...base.columns, {name: OVERFLOW_COLUMN, kind: "json"} as ColumnSpec].map(column =>
      definition.orderedJson?.includes(column.name) ? {...column, orderedJson: true} : column
    )
  };
}

/** All of them are created at startup (idempotent). */
export function systemTables(): TableSpec[] {
  return DEFINITIONS.map(d => systemTable(d.name)!);
}
