/*
 * Gives the access rule specs one `replace / select` surface over both engines. These specs pin
 * the SQL the rule compiler writes against tables they lay out themselves, so on PostgreSQL
 * `select` and `hiddenFields` run the compiler's output directly, and the documents are written
 * through BUCKET_WRITE into buckets that are stored next to those tables.
 */
import {Test, TestingModule} from "@nestjs/testing";
import {aggregate} from "@spica-server/bucket-expression";
import {
  applyVisibility,
  buckets,
  compileFieldRules,
  compileRule,
  createStatements,
  ORM,
  UuidV7Type,
  visibilitySelect
} from "@spica-server/data-postgresql";
import {Orm, quote} from "@spica-server/data-postgresql-orm";
import {BUCKET_WRITE, BucketWriteFacade} from "@spica-server/interface-bucket-common";
import {
  ContractEngine,
  DatabaseService,
  DatabaseTestingModule
} from "@spica-server/database-testing";
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
  const orm = module.get<Orm>(ORM);
  const uuid = new UuidV7Type();
  const idByLabel = new Map<string, string>();
  let mainLabels: string[] = [];

  const writes = module.get<BucketWriteFacade>(BUCKET_WRITE);
  const storedBuckets = Object.fromEntries(
    Object.values(TARGETS).map(({bucket, metadata}) => [
      metadata.bucketId,
      {...bucket, _id: metadata.bucketId}
    ])
  );

  for (const {metadata} of [TARGETS.third, TARGETS.other, TARGETS.main]) {
    await orm.executeStatements(createStatements(metadata));
    await orm.insert(buckets, storedBuckets[metadata.bucketId]);
  }

  const idOf = (label: string) => {
    if (!idByLabel.has(label)) {
      idByLabel.set(label, uuid.generate());
    }
    return idByLabel.get(label)!;
  };

  const labelOf = (id: string) => [...idByLabel].find(([, other]) => other == id)![0];

  const documentOf = (fields: Record<string, any>, schema: Record<string, any>) => {
    const resolve = (
      values: Record<string, any>,
      properties: Record<string, any>,
      path: string[]
    ) =>
      Object.fromEntries(
        Object.entries(values).map(([name, value]) => {
          const property = properties[name];
          if (!property) {
            throw new Error(`"${[...path, name].join(".")}" is not a property of the bucket.`);
          }
          if (property.type == "object") {
            return [name, resolve(value, property.properties, [...path, name])];
          }
          if (property.type == "relation") {
            return [name, property.relationType == "onetomany" ? value.map(idOf) : idOf(value)];
          }
          return [name, value];
        })
      );
    return resolve(fields, schema, []);
  };

  async function insert(documents: Documents, into: Target = "main") {
    const {bucket, metadata} = TARGETS[into];
    const stored = storedBuckets[metadata.bucketId];
    const context = {
      resolveSchema: (id: unknown) => storedBuckets[String(id)],
      deleteOne: async () => {}
    };

    for (const [label, document] of Object.entries(documents)) {
      await writes.insert(
        stored,
        {
          [metadata.primaryKey.field]: idOf(label),
          ...documentOf(document, bucket.properties as Record<string, any>)
        },
        {},
        context
      );
    }
    if (into == "main") {
      mainLabels.push(...Object.keys(documents));
    }
  }

  async function reset() {
    const tables = Object.values(TARGETS).flatMap(({metadata}) => metadata.tables.map(t => t.name));
    await orm.truncate(tables);
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
      const {rows} = await orm.raw(
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
      const {rows} = await orm.raw(
        `SELECT ${mainId}${flags.join("")} FROM ${mainTable} ${fields.joins.join(" ")}`,
        values
      );

      const properties = Object.keys(rules);
      const document = Object.fromEntries(properties.map(property => [property, true]));
      return Object.fromEntries(
        rows.map(row => {
          const kept = Object.keys(applyVisibility(document, row, fields));
          return [
            labelOf(row.id),
            properties.filter(p => !kept.includes(p)).sort((a, b) => a.localeCompare(b))
          ];
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
