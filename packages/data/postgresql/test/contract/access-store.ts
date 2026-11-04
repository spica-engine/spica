/*
 * TEMPORARY. Gives the access rule specs one `replace / select` surface over both engines while
 * PostgreSQL has no write or query facade.
 *
 * Remove it once these parts are merged, and use the facades from the specs directly:
 * - Part 9 binds BUCKET_WRITE on PostgreSQL: `replace` becomes `BUCKET_WRITE.insert` on both engines.
 * - Part 8 binds BUCKET_QUERY on PostgreSQL: `select` becomes `BUCKET_QUERY.find` with `applyAcl` on
 *   both engines, and `hiddenFields` a read of the same facade.
 * `PostgresAccessStore` goes with them. It exists for the specs of relations and field rules, which
 * read the output of the rule compiler until the facades do.
 */
import {Test, TestingModule} from "@nestjs/testing";
import {aggregate} from "@spica-server/bucket-expression";
import {
  applyVisibility,
  compileFieldRules,
  compileRule,
  createStatements,
  UuidV7Type,
  visibilitySelect
} from "@spica-server/data-postgresql";
import {quote} from "@spica-server/data-postgresql-orm";
import {
  ContractEngine,
  DatabaseService,
  DatabaseTestingModule
} from "@spica-server/database-testing";
import {PG_POOL} from "@spica-server/interface-data";
import pg from "pg";
import {
  otherBucket,
  otherMetadata,
  relatedFor,
  ruleBucket,
  ruleMetadata,
  thirdBucket,
  thirdMetadata,
  withFieldRules
} from "../access/rule-fixtures";

export const HASH_SECRET = "secret";

/** Documents by label. Results are labels, in the order the documents were written. */
export type Documents = Record<string, Record<string, unknown>>;

export interface AccessStore {
  /** Empties the store, then writes the documents. */
  replace(documents: Documents): Promise<void>;
  /** The labels of the documents the read rule lets through. */
  select(rule: string, auth?: unknown): Promise<string[]>;
}

export async function createAccessStore(
  engine: ContractEngine,
  module: TestingModule
): Promise<AccessStore> {
  return engine.name == "mongodb" ? mongoStore(module) : createPostgresAccessStore(module);
}

function mongoStore(module: TestingModule): AccessStore {
  const collection = () => module.get(DatabaseService).collection("access_rule_cases");
  let labels: string[] = [];

  return {
    async replace(documents) {
      labels = Object.keys(documents);
      await collection().deleteMany({});
      await collection().insertMany(
        labels.map(label => ({_id: label as never, ...documents[label]}))
      );
    },
    async select(rule, auth = {}) {
      const found = await collection()
        .aggregate([{$match: aggregate(rule, {auth}, "match")}])
        .toArray();
      const matched = new Set(found.map(document => String(document._id)));
      return labels.filter(label => matched.has(label));
    }
  };
}

type Target = "main" | "other" | "third";

const TARGETS = {
  main: {bucket: ruleBucket, metadata: ruleMetadata},
  other: {bucket: otherBucket, metadata: otherMetadata},
  third: {bucket: thirdBucket, metadata: thirdMetadata}
};

export interface PostgresAccessStore extends AccessStore {
  /**
   * Appends documents to one of the three buckets. A relation field names the label of the
   * document it points at, so related documents are written first.
   */
  insert(documents: Documents, into?: Target): Promise<void>;
  /** Empties all three buckets. */
  reset(): Promise<void>;
  /** The id written for a label, for rules that name a related document in `auth`. */
  idOf(label: string): string;
  /** For each document, the fields the field rules hide. */
  hiddenFields(rules: Record<string, string>, auth?: unknown): Promise<Record<string, string[]>>;
}

export async function createPostgresAccessStore(
  module: TestingModule
): Promise<PostgresAccessStore> {
  const pool = module.get<pg.Pool>(PG_POOL);
  const uuid = new UuidV7Type();
  const idByLabel = new Map<string, string>();
  let mainLabels: string[] = [];

  for (const {metadata} of [TARGETS.third, TARGETS.other, TARGETS.main]) {
    for (const statement of createStatements(metadata)) {
      await pool.query(statement);
    }
  }

  const idOf = (label: string) => {
    if (!idByLabel.has(label)) {
      idByLabel.set(label, uuid.generate());
    }
    return idByLabel.get(label)!;
  };

  const labelOf = (id: string) => [...idByLabel].find(([, other]) => other == id)![0];

  async function insertRow(table: string, record: Record<string, unknown>) {
    const columns = Object.keys(record);
    await pool.query(
      `INSERT INTO ${quote(table)} (${columns.map(quote).join(", ")})
       VALUES (${columns.map((_, index) => `$${index + 1}`).join(", ")})`,
      Object.values(record)
    );
  }

  async function insert(documents: Documents, into: Target = "main") {
    const {bucket, metadata} = TARGETS[into];
    const properties = bucket.properties as Record<string, any>;

    for (const [label, document] of Object.entries(documents)) {
      const id = idOf(label);
      const row: Record<string, unknown> = {[metadata.primaryKey.column]: id};
      const lists: [path: string[], values: unknown[]][] = [];

      const write = (fields: Record<string, any>, schema: Record<string, any>, path: string[]) => {
        for (const [name, value] of Object.entries(fields)) {
          const property = schema[name];
          const fieldPath = [...path, name];
          if (!property) {
            throw new Error(`"${fieldPath.join(".")}" is not a property of the ${into} bucket.`);
          }
          if (property.type == "object") {
            write(value, property.properties, fieldPath);
          } else if (property.type == "relation" && property.relationType == "onetomany") {
            lists.push([fieldPath, value.map(idOf)]);
          } else if (property.type == "relation") {
            row[metadata.columnOf(fieldPath)!.name] = idOf(value);
          } else if (property.type == "array") {
            lists.push([fieldPath, value]);
          } else {
            const column = metadata.columnOf(fieldPath)!;
            row[column.name] = column.type == "jsonb" ? JSON.stringify(value) : value;
          }
        }
      };
      write(document, properties, []);

      await insertRow(metadata.main.name, row);

      for (const [path, values] of lists) {
        const table = metadata.tables.find(
          candidate => candidate.path.join(".") == path.join(".")
        )!;
        const element = metadata.columnOf(path)!;
        for (const [position, value] of values.entries()) {
          await insertRow(table.name, {
            _parent: id,
            _position: position,
            [element.name]: element.type == "jsonb" ? JSON.stringify(value) : value
          });
        }
      }
    }
    if (into == "main") {
      mainLabels.push(...Object.keys(documents));
    }
  }

  async function reset() {
    const tables = Object.values(TARGETS).flatMap(({metadata}) => metadata.tables.map(t => t.name));
    await pool.query(`TRUNCATE ${tables.map(quote).join(", ")} CASCADE`);
    idByLabel.clear();
    mainLabels = [];
  }

  const mainTable = `${quote(ruleMetadata.main.name)} AS "t"`;
  const mainId = `"t".${quote(ruleMetadata.primaryKey.column)} AS id`;

  return {
    insert,
    reset,
    idOf,
    async replace(documents) {
      await reset();
      await insert(documents);
    },
    async select(rule, auth = {}) {
      const values: unknown[] = [];
      const related = await relatedFor(rule);
      const {sql, joins} = compileRule(
        rule,
        {
          bucket: ruleBucket,
          metadata: ruleMetadata,
          auth,
          hashSecret: HASH_SECRET,
          table: "t",
          related
        },
        values
      );
      const {rows} = await pool.query(
        `SELECT ${mainId} FROM ${mainTable} ${joins.join(" ")} WHERE ${sql}`,
        values
      );
      const matched = new Set(rows.map(row => labelOf(row.id)));
      return mainLabels.filter(label => matched.has(label));
    },
    async hiddenFields(rules, auth = {}) {
      const values: unknown[] = [];
      const related = await relatedFor(Object.values(rules));
      const fields = compileFieldRules(
        {bucket: withFieldRules(rules), metadata: ruleMetadata, auth, table: "t", related},
        values
      );
      const flags = visibilitySelect(fields).map(flag => `, ${flag}`);
      const {rows} = await pool.query(
        `SELECT ${mainId}${flags.join("")} FROM ${mainTable} ${fields.joins.join(" ")}`,
        values
      );

      const properties = Object.keys(rules);
      const document = Object.fromEntries(properties.map(property => [property, true]));
      return Object.fromEntries(
        rows.map(row => {
          const kept = Object.keys(applyVisibility(document, row, fields));
          return [labelOf(row.id), properties.filter(p => !kept.includes(p)).sort()];
        })
      );
    }
  };
}

/**
 * Starts PostgreSQL for the specs of one file and hands out the store. Call it in the body of a
 * `describe`; the store works from `beforeAll` on.
 */
export function usePostgresAccessStore(): PostgresAccessStore {
  let module: TestingModule;
  let store: PostgresAccessStore;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [DatabaseTestingModule.postgres()]
    }).compile();
    await module.init();
    store = await createPostgresAccessStore(module);
  }, 120_000);

  afterAll(() => module.close());

  return {
    insert: (documents, into) => store.insert(documents, into),
    reset: () => store.reset(),
    idOf: label => store.idOf(label),
    replace: documents => store.replace(documents),
    select: (rule, auth) => store.select(rule, auth),
    hiddenFields: (rules, auth) => store.hiddenFields(rules, auth)
  };
}
