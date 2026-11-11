import {BadRequestException} from "@nestjs/common";
import {Test, TestingModule} from "@nestjs/testing";
import {provideRepository, idOf} from "@spica-server/data";
import {DatabaseTestingModule} from "@spica-server/database-testing";
import {
  BUCKET_REPOSITORY,
  BUCKET_SCHEMA_MANAGER,
  BucketRepository,
  BucketSchemaManager
} from "@spica-server/interface-bucket";
import {PG_POOL} from "@spica-server/interface-data";
import {constraintName, ORM} from "@spica-server/data-postgresql";
import {Orm, Session} from "@spica-server/data-postgresql-orm";
import pg from "pg";

describe("PostgreSQL schema manager", () => {
  let module: TestingModule;
  let pool: pg.Pool;
  let orm: Orm;
  let manager: BucketSchemaManager;
  let buckets: BucketRepository;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [DatabaseTestingModule.postgres()],
      providers: [provideRepository(BUCKET_REPOSITORY), provideRepository(BUCKET_SCHEMA_MANAGER)]
    }).compile();
    await module.init();
    pool = module.get(PG_POOL);
    orm = module.get(ORM);
    manager = module.get(BUCKET_SCHEMA_MANAGER);
    buckets = module.get(BUCKET_REPOSITORY);
  }, 120_000);

  afterAll(() => module.close());

  const bucket = (extra: object = {}): any => ({
    title: "Books",
    primary: "id",
    acl: {read: "true==true", write: "true==true"},
    properties: {id: {type: "uuid", options: {generated: true}}, title: {type: "string"}},
    ...extra
  });

  const tableOf = (id: any) => `bucket_${id}`;

  const columns = async (table: string) => {
    const {rows} = await pool.query(
      `SELECT column_name, data_type, is_nullable, column_default, is_identity
       FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = $1
       ORDER BY column_name`,
      [table]
    );
    return rows;
  };

  const tables = async () => {
    const {rows} = await pool.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = current_schema() AND table_name LIKE 'bucket\\_%' ORDER BY table_name"
    );
    return rows.map(row => row.table_name);
  };

  const tablesOfBucket = async (table: string) =>
    (await tables()).filter(name => name.startsWith(table));

  const constraints = async (table: string) => {
    const {rows} = await pool.query(
      "SELECT conname, contype FROM pg_constraint WHERE conrelid = to_regclass($1) AND contype <> 'n' ORDER BY conname",
      [`"${table}"`]
    );
    return rows;
  };

  const indexes = async (table: string) => {
    const {rows} = await pool.query(
      "SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = current_schema() AND tablename = $1 AND indexname NOT IN (SELECT conname FROM pg_constraint) ORDER BY indexname",
      [table]
    );
    return rows;
  };

  describe("create", () => {
    it("should save the definition and create the table with the key and the columns", async () => {
      const onSaved = jest.fn();

      const created = await manager.create(
        bucket({
          required: ["title"],
          properties: {
            id: {type: "uuid", options: {generated: true}},
            title: {type: "string"},
            price: {type: "number"},
            published: {type: "boolean"},
            released: {type: "date"},
            meta: {type: "json"}
          }
        }),
        onSaved
      );

      expect(onSaved).toHaveBeenCalledWith(created);
      expect(await buckets.findById(idOf(created))).toEqual(created);
      expect(await columns(tableOf(idOf(created)))).toEqual([
        expect.objectContaining({
          column_name: "id",
          data_type: "uuid",
          is_nullable: "NO",
          column_default: "uuidv7()"
        }),
        expect.objectContaining({column_name: "meta", data_type: "jsonb", is_nullable: "YES"}),
        expect.objectContaining({column_name: "price", data_type: "double precision"}),
        expect.objectContaining({column_name: "published", data_type: "boolean"}),
        expect.objectContaining({column_name: "released", data_type: "timestamp with time zone"}),
        expect.objectContaining({column_name: "title", data_type: "text", is_nullable: "NO"})
      ]);
      expect(await constraints(tableOf(idOf(created)))).toEqual([
        {conname: `${tableOf(idOf(created))}_id_pk`, contype: "p"}
      ]);
    });

    it.each([
      ["integer", "integer"],
      ["bigint", "bigint"]
    ])("should generate a %s key with an identity column", async (type, dataType) => {
      const created = await manager.create(
        bucket({
          primary: "n",
          properties: {n: {type, options: {generated: true}}}
        }),
        () => {}
      );

      expect(await columns(tableOf(idOf(created)))).toEqual([
        expect.objectContaining({column_name: "n", data_type: dataType, is_identity: "YES"})
      ]);
    });

    it("should let the caller provide a key that is not generated", async () => {
      const created = await manager.create(
        bucket({
          primary: "slug",
          properties: {slug: {type: "string"}}
        }),
        () => {}
      );

      expect(await columns(tableOf(idOf(created)))).toEqual([
        expect.objectContaining({
          column_name: "slug",
          data_type: "text",
          is_nullable: "NO",
          column_default: null,
          is_identity: "NO"
        })
      ]);
    });

    it("should generate keys when rows are inserted", async () => {
      const created = await manager.create(
        bucket({
          primary: "n",
          properties: {n: {type: "bigint", options: {generated: true}}, title: {type: "string"}}
        }),
        () => {}
      );
      const table = tableOf(idOf(created));

      await pool.query(`INSERT INTO "${table}" (title) VALUES ('a'), ('b')`);

      const {rows} = await pool.query(`SELECT n FROM "${table}" ORDER BY n`);
      expect(rows.map(row => Number(row.n))).toEqual([1, 2]);
    });

    it("should create enum checks and indexes", async () => {
      const created = await manager.create(
        bucket({
          properties: {
            id: {type: "uuid", options: {generated: true}},
            kind: {type: "string", enum: ["novel", "essay"]},
            isbn: {type: "string"},
            author: {type: "string"},
            year: {type: "number"}
          },
          indexes: [
            {definition: {isbn: 1}, options: {unique: true}},
            {definition: {author: 1, year: -1}, options: {}}
          ]
        }),
        () => {}
      );
      const table = tableOf(idOf(created));

      expect(await constraints(table)).toEqual([
        {conname: `${table}_id_pk`, contype: "p"},
        {conname: `${table}_kind_ck`, contype: "c"}
      ]);
      expect(await indexes(table)).toEqual([
        {
          indexname: `${table}_author_year_desc_ix`,
          indexdef: expect.stringContaining("(author, year DESC)")
        },
        {
          indexname: `${table}_isbn_uq`,
          indexdef: expect.stringContaining("CREATE UNIQUE INDEX")
        }
      ]);
      await expect(
        pool.query(`INSERT INTO "${table}" (kind) VALUES ('poem')`)
      ).rejects.toMatchObject({code: "23514"});
    });

    it("should not save the definition when the structure cannot be created", async () => {
      const before = await tables();

      await expect(
        manager.create(bucket({indexes: [{definition: {nope: 1}, options: {}}]}), () => {})
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(await tables()).toEqual(before);
    });
  });

  describe("replace", () => {
    it("should add, drop and relax columns, and move constraints and indexes", async () => {
      const created = await manager.create(
        bucket({
          required: ["title"],
          properties: {
            id: {type: "uuid", options: {generated: true}},
            title: {type: "string"},
            gone: {type: "string"},
            kind: {type: "string", enum: ["a"]},
            isbn: {type: "string"}
          },
          indexes: [{definition: {isbn: 1}, options: {}}]
        }),
        () => {}
      );
      const table = tableOf(idOf(created));
      const onSaved = jest.fn();

      await manager.replace(
        idOf(created),
        bucket({
          required: ["fresh"],
          properties: {
            id: {type: "uuid", options: {generated: true}},
            title: {type: "string"},
            kind: {type: "string", enum: ["a", "b"]},
            isbn: {type: "string"},
            fresh: {type: "number"}
          },
          indexes: [{definition: {isbn: 1}, options: {unique: true}}]
        }),
        onSaved
      );

      expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({_id: idOf(created)}));
      expect((await columns(table)).map(c => [c.column_name, c.is_nullable])).toEqual([
        ["fresh", "NO"],
        ["id", "NO"],
        ["isbn", "YES"],
        ["kind", "YES"],
        ["title", "YES"]
      ]);
      await pool.query(`INSERT INTO "${table}" (fresh, kind) VALUES (1, 'b')`);
      await expect(
        pool.query(`INSERT INTO "${table}" (fresh, kind) VALUES (1, 'c')`)
      ).rejects.toMatchObject({code: "23514"});
      expect((await indexes(table)).map(index => index.indexname)).toEqual([`${table}_isbn_uq`]);
    });

    it("should leave the definition and the structure alone when the change fails", async () => {
      const original = bucket();
      const created = await manager.create(original, () => {});
      const table = tableOf(idOf(created));
      await pool.query(`INSERT INTO "${table}" (title) VALUES ('a')`);
      const onSaved = jest.fn();

      await expect(
        manager.replace(
          idOf(created),
          bucket({
            required: ["extra"],
            properties: {
              id: {type: "uuid", options: {generated: true}},
              title: {type: "string"},
              extra: {type: "string"}
            }
          }),
          onSaved
        )
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(onSaved).not.toHaveBeenCalled();
      expect(await buckets.findById(idOf(created))).toEqual(created);
      expect((await columns(table)).map(c => c.column_name)).toEqual(["id", "title"]);
    });

    it("should accept a retype that keeps the column type", async () => {
      const created = await manager.create(
        bucket({properties: {id: {type: "uuid", options: {generated: true}}, n: {type: "string"}}}),
        () => {}
      );

      await manager.replace(
        idOf(created),
        bucket({
          properties: {id: {type: "uuid", options: {generated: true}}, n: {type: "textarea"}}
        }),
        () => {}
      );

      expect((await columns(tableOf(idOf(created)))).map(c => c.data_type)).toEqual([
        "uuid",
        "text"
      ]);
    });

    it("should create the table of a bucket that was saved before it had one", async () => {
      const legacy = await buckets.insert(bucket());

      await manager.replace(idOf(legacy), bucket(), () => {});

      expect((await columns(tableOf(idOf(legacy)))).map(c => c.column_name)).toEqual([
        "id",
        "title"
      ]);
    });

    it("should resolve to null for a bucket that does not exist", async () => {
      const onSaved = jest.fn();

      expect(
        await manager.replace("0198a7e0-7b1c-7d2e-9f3a-4b5c6d7e8f90" as any, bucket(), onSaved)
      ).toBeNull();
      expect(onSaved).not.toHaveBeenCalled();
    });
  });

  describe("objects and arrays", () => {
    const withShape = (properties: object = {}, extra: object = {}) =>
      bucket({
        properties: {id: {type: "uuid", options: {generated: true}}, ...properties},
        ...extra
      });

    const shape = {
      address: {
        type: "object",
        required: ["city"],
        properties: {
          city: {type: "string"},
          geo: {type: "object", properties: {lat: {type: "number"}}}
        }
      },
      tags: {type: "array", items: {type: "string"}},
      lines: {
        type: "array",
        items: {
          type: "object",
          required: ["sku"],
          properties: {sku: {type: "string"}, qty: {type: "number"}}
        }
      },
      kinds: {type: "multiselect", items: {type: "string", enum: ["a", "b"]}}
    };

    it("should create prefixed columns and a child table per array", async () => {
      const created = await manager.create(withShape(shape), () => {});
      const table = tableOf(idOf(created));

      expect((await columns(table)).map(c => c.column_name)).toEqual([
        "address__city",
        "address__geo__lat",
        "id"
      ]);
      expect(await tablesOfBucket(table)).toEqual(
        [table, `${table}__kinds`, `${table}__lines`, `${table}__tags`].sort()
      );
      expect(await columns(`${table}__tags`)).toEqual([
        expect.objectContaining({column_name: "_parent", data_type: "uuid", is_nullable: "NO"}),
        expect.objectContaining({
          column_name: "_position",
          data_type: "integer",
          is_nullable: "NO"
        }),
        expect.objectContaining({column_name: "_value", data_type: "text", is_nullable: "NO"})
      ]);
      expect((await columns(`${table}__lines`)).map(c => [c.column_name, c.is_nullable])).toEqual([
        ["_parent", "NO"],
        ["_position", "NO"],
        ["qty", "YES"],
        ["sku", "NO"]
      ]);
      expect(await constraints(`${table}__tags`)).toEqual(
        [
          {conname: constraintName(`${table}__tags`, ["_parent"], "fk"), contype: "f"},
          {conname: constraintName(`${table}__tags`, ["_parent", "_position"], "pk"), contype: "p"}
        ].sort((a, b) => (a.conname < b.conname ? -1 : 1))
      );
    });

    it("should keep array items with their parent, in order, and remove them with it", async () => {
      const created = await manager.create(withShape({tags: shape.tags}), () => {});
      const table = tableOf(idOf(created));
      const {rows} = await pool.query(`INSERT INTO "${table}" DEFAULT VALUES RETURNING id`);
      await pool.query(
        `INSERT INTO "${table}__tags" (_parent, _position, _value) VALUES ($1, 1, 'b'), ($1, 0, 'a')`,
        [rows[0].id]
      );

      const items = await pool.query(`SELECT _value FROM "${table}__tags" ORDER BY _position`);
      expect(items.rows.map(row => row._value)).toEqual(["a", "b"]);
      await expect(
        pool.query(`INSERT INTO "${table}__tags" VALUES ($1, 0, 'dup')`, [rows[0].id])
      ).rejects.toMatchObject({code: "23505"});
      await expect(
        pool.query(`INSERT INTO "${table}__tags" VALUES (gen_random_uuid(), 0, 'orphan')`)
      ).rejects.toMatchObject({code: "23503"});

      await pool.query(`DELETE FROM "${table}" WHERE id = $1`, [rows[0].id]);
      expect((await pool.query(`SELECT 1 FROM "${table}__tags"`)).rowCount).toBe(0);
    });

    it("should check the enum of a multiselect", async () => {
      const created = await manager.create(withShape({kinds: shape.kinds}), () => {});
      const table = tableOf(idOf(created));
      const {rows} = await pool.query(`INSERT INTO "${table}" DEFAULT VALUES RETURNING id`);

      await expect(
        pool.query(`INSERT INTO "${table}__kinds" VALUES ($1, 0, 'c')`, [rows[0].id])
      ).rejects.toMatchObject({code: "23514"});
    });

    it("should add and drop columns and child tables as properties come and go", async () => {
      const created = await manager.create(withShape({tags: shape.tags}), () => {});
      const table = tableOf(idOf(created));

      await manager.replace(
        idOf(created),
        withShape({address: shape.address, lines: shape.lines}),
        () => {}
      );

      expect(await tablesOfBucket(table)).toEqual([table, `${table}__lines`]);
      expect((await columns(table)).map(c => c.column_name)).toEqual([
        "address__city",
        "address__geo__lat",
        "id"
      ]);

      await manager.replace(
        idOf(created),
        withShape({
          address: {...shape.address, properties: {city: {type: "string"}}},
          lines: {
            ...shape.lines,
            items: {
              type: "object",
              properties: {sku: {type: "string"}, note: {type: "string"}}
            }
          }
        }),
        () => {}
      );

      expect((await columns(table)).map(c => c.column_name)).toEqual(["address__city", "id"]);
      expect((await columns(`${table}__lines`)).map(c => [c.column_name, c.is_nullable])).toEqual([
        ["_parent", "NO"],
        ["_position", "NO"],
        ["note", "YES"],
        ["sku", "YES"]
      ]);
    });

    it("should follow a change of the required object and of the item enum", async () => {
      const created = await manager.create(withShape(shape), () => {});
      const table = tableOf(idOf(created));

      await manager.replace(
        idOf(created),
        withShape(
          {...shape, kinds: {type: "multiselect", items: {type: "string", enum: ["a", "b", "c"]}}},
          {required: ["address"]}
        ),
        () => {}
      );

      const city = (await columns(table)).find(c => c.column_name == "address__city");
      expect(city.is_nullable).toBe("NO");
      const {rows} = await pool.query(
        `INSERT INTO "${table}" (address__city) VALUES ('x') RETURNING id`
      );
      await pool.query(`INSERT INTO "${table}__kinds" VALUES ($1, 0, 'c')`, [rows[0].id]);
    });

    it("should index the items of an array on its child table", async () => {
      const created = await manager.create(
        withShape(
          {tags: shape.tags},
          {indexes: [{definition: {tags: 1}, options: {unique: true}}]}
        ),
        () => {}
      );
      const table = tableOf(idOf(created));

      expect((await indexes(`${table}__tags`)).map(index => index.indexname)).toEqual([
        constraintName(`${table}__tags`, ["_value"], "uq")
      ]);

      await manager.replace(idOf(created), withShape({tags: shape.tags}), () => {});

      expect(await indexes(`${table}__tags`)).toEqual([]);
    });

    it("should drop the child tables together with the bucket", async () => {
      const created = await manager.create(withShape(shape), () => {});

      await manager.drop(idOf(created), () => {});

      expect(await tablesOfBucket(tableOf(idOf(created)))).toEqual([]);
    });
  });

  describe("relations", () => {
    const keyed = (properties: object, extra: object = {}) =>
      bucket({
        properties: {id: {type: "uuid", options: {generated: true}}, ...properties},
        ...extra
      });

    const relation = (bucketId: any, relationType: string) => ({
      type: "relation",
      bucketId: String(bucketId),
      relationType
    });

    const foreignKeys = async (table: string) => {
      const {rows} = await pool.query(
        `SELECT conname, confrelid::regclass::text AS target, confdeltype FROM pg_constraint
         WHERE conrelid = to_regclass($1) AND contype = 'f' ORDER BY conname`,
        [`"${table}"`]
      );
      return rows.map(row => [row.conname, row.target.replace(/"/g, ""), row.confdeltype]);
    };

    it("should turn a onetoone relation into a foreign key column typed after the target key", async () => {
      const target = await manager.create(
        bucket({
          primary: "n",
          properties: {n: {type: "bigint", options: {generated: true}}}
        }),
        () => {}
      );

      const created = await manager.create(
        keyed({owner: relation(idOf(target), "onetoone")}),
        () => {}
      );
      const table = tableOf(idOf(created));

      expect((await columns(table)).find(c => c.column_name == "owner")).toMatchObject({
        data_type: "bigint",
        is_nullable: "YES"
      });
      expect(await foreignKeys(table)).toEqual([
        [constraintName(table, ["owner"], "fk"), tableOf(idOf(target)), "n"]
      ]);
    });

    it("should set the reference to null when the related row goes, unless it is required", async () => {
      const target = await manager.create(keyed({}), () => {});
      const targetTable = tableOf(idOf(target));
      const optional = await manager.create(
        keyed({owner: relation(idOf(target), "onetoone")}),
        () => {}
      );
      const required = await manager.create(
        keyed({owner: relation(idOf(target), "onetoone")}, {required: ["owner"]}),
        () => {}
      );
      const {rows} = await pool.query(`INSERT INTO "${targetTable}" DEFAULT VALUES RETURNING id`);
      await pool.query(`INSERT INTO "${tableOf(idOf(optional))}" (owner) VALUES ($1)`, [
        rows[0].id
      ]);

      await pool.query(`DELETE FROM "${targetTable}" WHERE id = $1`, [rows[0].id]);

      const left = await pool.query(`SELECT owner FROM "${tableOf(idOf(optional))}"`);
      expect(left.rows).toEqual([{owner: null}]);
      await pool.query(`INSERT INTO "${targetTable}" (id) VALUES ($1)`, [rows[0].id]);
      await pool.query(`INSERT INTO "${tableOf(idOf(required))}" (owner) VALUES ($1)`, [
        rows[0].id
      ]);
      await expect(
        pool.query(`DELETE FROM "${targetTable}" WHERE id = $1`, [rows[0].id])
      ).rejects.toMatchObject({code: "23503"});
    });

    it("should link a onetomany relation through an ordered link table", async () => {
      const target = await manager.create(keyed({}), () => {});
      const created = await manager.create(
        keyed({friends: relation(idOf(target), "onetomany")}),
        () => {}
      );
      const table = tableOf(idOf(created));
      const link = `${table}__friends`;

      expect((await columns(link)).map(c => [c.column_name, c.data_type])).toEqual([
        ["_parent", "uuid"],
        ["_position", "integer"],
        ["_target", "uuid"]
      ]);
      expect(await foreignKeys(link)).toEqual(
        [
          [constraintName(link, ["_parent"], "fk"), table, "c"],
          [constraintName(link, ["_target"], "fk"), tableOf(idOf(target)), "c"]
        ].sort((a, b) => (a[0] < b[0] ? -1 : 1))
      );

      const targets = await pool.query(
        `INSERT INTO "${tableOf(idOf(target))}" DEFAULT VALUES RETURNING id`
      );
      const parent = await pool.query(`INSERT INTO "${table}" DEFAULT VALUES RETURNING id`);
      await pool.query(`INSERT INTO "${link}" VALUES ($1, 0, $2)`, [
        parent.rows[0].id,
        targets.rows[0].id
      ]);
      await pool.query(`DELETE FROM "${tableOf(idOf(target))}"`);
      expect((await pool.query(`SELECT 1 FROM "${link}"`)).rowCount).toBe(0);
    });

    it("should allow a bucket to relate to itself", async () => {
      const id = "0198a7e0-7b1c-7d2e-9f3a-4b5c6d7e8f90";
      const created = await manager.create(
        keyed({parent: relation(id, "onetoone")}, {_id: id}),
        () => {}
      );

      expect(await foreignKeys(tableOf(idOf(created)))).toEqual([
        [constraintName(tableOf(id), ["parent"], "fk"), tableOf(id), "n"]
      ]);
    });

    it("should refuse a relation to a bucket that does not exist", async () => {
      const before = (await tables()).length;

      await expect(
        manager.create(
          keyed({owner: relation("0198a7e0-0000-7d2e-9f3a-4b5c6d7e8f91", "onetoone")}),
          () => {}
        )
      ).rejects.toThrow('refers to the bucket "0198a7e0-0000-7d2e-9f3a-4b5c6d7e8f91"');
      expect((await tables()).length).toBe(before);
    });

    it("should relate from inside an object and an array item", async () => {
      const target = await manager.create(keyed({}), () => {});
      const created = await manager.create(
        keyed({
          boss: {type: "object", properties: {who: relation(idOf(target), "onetoone")}},
          lines: {
            type: "array",
            items: {type: "object", properties: {product: relation(idOf(target), "onetoone")}}
          },
          crew: {type: "object", properties: {members: relation(idOf(target), "onetomany")}}
        }),
        () => {}
      );
      const table = tableOf(idOf(created));

      expect((await columns(table)).map(c => c.column_name)).toEqual(["boss__who", "id"]);
      expect((await columns(`${table}__lines`)).map(c => c.column_name)).toEqual([
        "_parent",
        "_position",
        "product"
      ]);
      expect((await columns(`${table}__crew__members`)).map(c => c.column_name)).toEqual([
        "_parent",
        "_position",
        "_target"
      ]);
    });

    it("should add, retarget and remove relations on edit", async () => {
      const first = await manager.create(keyed({}), () => {});
      const second = await manager.create(keyed({}), () => {});
      const created = await manager.create(keyed({}), () => {});
      const table = tableOf(idOf(created));

      await manager.replace(
        idOf(created),
        keyed({one: relation(idOf(first), "onetoone"), many: relation(idOf(first), "onetomany")}),
        () => {}
      );
      expect(await foreignKeys(table)).toEqual([
        [constraintName(table, ["one"], "fk"), tableOf(idOf(first)), "n"]
      ]);
      expect(await tablesOfBucket(table)).toEqual([table, `${table}__many`]);

      await manager.replace(
        idOf(created),
        keyed({one: relation(idOf(second), "onetoone"), many: relation(idOf(second), "onetomany")}),
        () => {}
      );
      expect(await foreignKeys(table)).toEqual([
        [constraintName(table, ["one"], "fk"), tableOf(idOf(second)), "n"]
      ]);
      expect((await foreignKeys(`${table}__many`)).map(key => key[1]).sort()).toEqual(
        [table, tableOf(idOf(second))].sort()
      );

      await manager.replace(idOf(created), keyed({}), () => {});
      expect(await foreignKeys(table)).toEqual([]);
      expect(await tablesOfBucket(table)).toEqual([table]);
    });

    it("should clear what referred to the old bucket when a relation is retargeted", async () => {
      const first = await manager.create(keyed({}), () => {});
      const second = await manager.create(keyed({}), () => {});
      const kept = await manager.create(keyed({}), () => {});
      const created = await manager.create(
        keyed({
          one: relation(idOf(first), "onetoone"),
          many: relation(idOf(first), "onetomany"),
          same: relation(idOf(kept), "onetoone")
        }),
        () => {}
      );
      const table = tableOf(idOf(created));
      const insertInto = async (target: string) => (await orm.table(target).insertRow({})).id;
      const firstRow = await insertInto(tableOf(idOf(first)));
      const keptRow = await insertInto(tableOf(idOf(kept)));
      const row = (await orm.table(table).insertRow({one: firstRow, same: keptRow})).id;
      await orm.table(`${table}__many`).insertRow({_parent: row, _position: 0, _target: firstRow});

      await manager.replace(
        idOf(created),
        keyed({
          one: relation(idOf(second), "onetoone"),
          many: relation(idOf(second), "onetomany"),
          same: relation(idOf(kept), "onetoone")
        }),
        () => {}
      );

      expect(await orm.table(table).rows()).toEqual([
        {id: expect.anything(), one: null, same: keptRow}
      ]);
      expect(await orm.table(`${table}__many`).rows()).toEqual([]);
    });

    describe("a relation inside the items of a list", () => {
      const lines = (required: string[], target: unknown) =>
        keyed({
          lines: {
            type: "array",
            items: {
              type: "object",
              required,
              properties: {sku: {type: "string"}, product: relation(target, "onetoone")}
            }
          }
        });

      const items = async (table: string) =>
        (await orm.table(`${table}__lines`).rows(["_position"])).map(({sku, product}) => ({
          sku,
          product
        }));

      async function itemsAround(required: string[]) {
        const first = await manager.create(keyed({}), () => {});
        const second = await manager.create(keyed({}), () => {});
        const created = await manager.create(lines(required, idOf(first)), () => {});
        const table = tableOf(idOf(created));
        const product = (await orm.table(tableOf(idOf(first))).insertRow({})).id;
        const parent = (await orm.table(table).insertRow({})).id;
        await orm.table(`${table}__lines`).insertRows(
          ["a", "b"].map((sku, position) => ({
            _parent: parent,
            _position: position,
            sku,
            product
          }))
        );
        return {first, second, created, table, product};
      }

      it("should clear the relation of each item and keep the items when it is retargeted", async () => {
        const {second, created, table} = await itemsAround([]);

        await manager.replace(idOf(created), lines([], idOf(second)), () => {});

        expect(await items(table)).toEqual([
          {sku: "a", product: null},
          {sku: "b", product: null}
        ]);
      });

      it("should refuse to retarget a required relation and keep every item", async () => {
        const {first, second, created, table, product} = await itemsAround(["product"]);
        const required = (target: unknown) => ({
          ...lines(["product"], target),
          required: ["lines"]
        });

        await expect(
          manager.replace(idOf(created), required(idOf(second)), () => {})
        ).rejects.toMatchObject({
          status: 400,
          message: expect.stringContaining("Existing documents refer to documents")
        });

        expect(await items(table)).toEqual([
          {sku: "a", product},
          {sku: "b", product}
        ]);
        expect((await foreignKeys(`${table}__lines`)).map(key => key[1])).toContain(
          tableOf(idOf(first))
        );
      });
    });

    it("should refuse to retarget a required relation that has values and change nothing", async () => {
      const first = await manager.create(keyed({}), () => {});
      const second = await manager.create(keyed({}), () => {});
      const created = await manager.create(
        keyed({one: relation(idOf(first), "onetoone")}, {required: ["one"]}),
        () => {}
      );
      const table = tableOf(idOf(created));
      const firstRow = (await orm.table(tableOf(idOf(first))).insertRow({})).id;
      await orm.table(table).insertRow({one: firstRow});

      await expect(
        manager.replace(
          idOf(created),
          keyed({one: relation(idOf(second), "onetoone")}, {required: ["one"]}),
          () => {}
        )
      ).rejects.toThrow();

      expect((await foreignKeys(table))[0][1]).toBe(tableOf(idOf(first)));
      expect((await orm.table(table).rows()).map(row => row.one)).toEqual([firstRow]);
    });

    it("should remove the relations that point at a bucket when it is dropped", async () => {
      const target = await manager.create(keyed({}), () => {});
      const other = await manager.create(keyed({}), () => {});
      const referencing = await manager.create(
        keyed(
          {
            title: {type: "string"},
            one: relation(idOf(target), "onetoone"),
            keep: relation(idOf(other), "onetoone"),
            many: relation(idOf(target), "onetomany"),
            boss: {
              type: "object",
              required: ["who"],
              properties: {who: relation(idOf(target), "onetoone"), name: {type: "string"}}
            }
          },
          {
            required: ["one", "title"],
            indexes: [
              {definition: {one: 1}, options: {}},
              {definition: {title: 1}, options: {}}
            ]
          }
        ),
        () => {}
      );
      const table = tableOf(idOf(referencing));
      const changed = jest.fn();
      const onSaved = jest.fn();

      await manager.drop(idOf(target), onSaved, changed);

      expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({_id: idOf(target)}));
      expect(await tablesOfBucket(tableOf(idOf(target)))).toEqual([]);
      expect(await tablesOfBucket(table)).toEqual([table]);
      expect((await columns(table)).map(c => c.column_name)).toEqual([
        "boss__name",
        "id",
        "keep",
        "title"
      ]);
      expect(await foreignKeys(table)).toEqual([
        [constraintName(table, ["keep"], "fk"), tableOf(idOf(other)), "n"]
      ]);
      const stored = await buckets.findById(idOf(referencing));
      expect(Object.keys(stored.properties)).toEqual(
        expect.arrayContaining(["id", "title", "keep", "boss"])
      );
      expect(stored.properties).not.toHaveProperty("one");
      expect(stored.properties).not.toHaveProperty("many");
      expect(stored.properties.boss).toMatchObject({
        required: [],
        properties: {name: {type: "string"}}
      });
      expect(stored.required).toEqual(["title"]);
      expect(stored.indexes).toEqual([{definition: {title: 1}, options: {}}]);
      expect(changed).toHaveBeenCalledTimes(1);
      expect(changed).toHaveBeenCalledWith(expect.objectContaining({_id: idOf(referencing)}));
    });

    it("should leave everything alone when a drop fails", async () => {
      const target = await manager.create(keyed({}), () => {});
      const referencing = await manager.create(
        keyed({one: relation(idOf(target), "onetoone")}),
        () => {}
      );
      await pool.query(`ALTER TABLE "${tableOf(idOf(referencing))}" ADD COLUMN stray text`);
      await pool.query(`CREATE TABLE "${tableOf(idOf(target))}__blocker" (x int)`);
      await pool.query(
        `CREATE FUNCTION fail_drop() RETURNS event_trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'no drops'; END $$`
      );
      await pool.query(
        `CREATE EVENT TRIGGER fail_drop_trigger ON sql_drop EXECUTE FUNCTION fail_drop()`
      );

      try {
        await expect(manager.drop(idOf(target), () => {})).rejects.toBeDefined();
      } finally {
        await pool.query(`DROP EVENT TRIGGER fail_drop_trigger`);
        await pool.query(`DROP FUNCTION fail_drop()`);
      }

      expect(await buckets.findById(idOf(target))).toBeTruthy();
      expect((await buckets.findById(idOf(referencing))).properties).toHaveProperty("one");
      expect((await columns(tableOf(idOf(referencing)))).map(c => c.column_name)).toContain("one");
    });
  });

  describe("translated properties", () => {
    const withShape = (properties: object = {}) =>
      bucket({properties: {id: {type: "uuid", options: {generated: true}}, ...properties}});

    const translated = {type: "string", options: {translate: true}};

    it("should create a table keyed by locale for a translated property", async () => {
      const created = await manager.create(
        withShape({name: translated, note: {type: "string"}}),
        () => {}
      );
      const table = tableOf(idOf(created));

      expect((await columns(table)).map(c => c.column_name)).toEqual(["id", "note"]);
      expect(await columns(`${table}__name`)).toEqual([
        expect.objectContaining({column_name: "_locale", data_type: "text", is_nullable: "NO"}),
        expect.objectContaining({column_name: "_parent", data_type: "uuid", is_nullable: "NO"}),
        expect.objectContaining({column_name: "_value", data_type: "text", is_nullable: "NO"})
      ]);

      const {rows} = await pool.query(`INSERT INTO "${table}" DEFAULT VALUES RETURNING id`);
      await pool.query(
        `INSERT INTO "${table}__name" VALUES ($1, 'en_US', 'Book'), ($1, 'tr_TR', 'Kitap')`,
        [rows[0].id]
      );
      await expect(
        pool.query(`INSERT INTO "${table}__name" VALUES ($1, 'en_US', 'Again')`, [rows[0].id])
      ).rejects.toMatchObject({code: "23505"});
      await pool.query(`DELETE FROM "${table}" WHERE id = $1`, [rows[0].id]);
      expect((await pool.query(`SELECT 1 FROM "${table}__name"`)).rowCount).toBe(0);
    });

    it("should add and drop the table as the translated property comes and goes", async () => {
      const created = await manager.create(withShape({}), () => {});
      const table = tableOf(idOf(created));

      await manager.replace(idOf(created), withShape({name: translated}), () => {});
      expect(await tablesOfBucket(table)).toEqual([table, `${table}__name`]);

      await manager.replace(idOf(created), withShape({}), () => {});
      expect(await tablesOfBucket(table)).toEqual([table]);
    });
  });

  describe("locations", () => {
    const withShape = (properties: object = {}, extra: object = {}) =>
      bucket({
        properties: {id: {type: "uuid", options: {generated: true}}, ...properties},
        ...extra
      });

    it("should store locations in point columns and index them with gist", async () => {
      const created = await manager.create(
        withShape(
          {place: {type: "location"}, stops: {type: "array", items: {type: "location"}}},
          {indexes: [{definition: {place: "2dsphere"}, options: {}}]}
        ),
        () => {}
      );
      const table = tableOf(idOf(created));

      expect((await columns(table)).find(c => c.column_name == "place").data_type).toBe("point");
      expect(
        (await columns(`${table}__stops`)).find(c => c.column_name == "_value").data_type
      ).toBe("point");
      expect((await indexes(table)).map(index => index.indexdef)).toEqual([
        expect.stringContaining("USING gist (place)")
      ]);

      await pool.query(`INSERT INTO "${table}" (place) VALUES (point(29.0, 41.0))`);
      const {rows} = await pool.query(
        `SELECT place[0] AS lng, place[1] AS lat FROM "${table}" WHERE place <@ box(point(28, 40), point(30, 42))`
      );
      expect(rows).toEqual([{lng: 29, lat: 41}]);
    });

    it("should add and drop a spatial index on edit", async () => {
      const created = await manager.create(withShape({place: {type: "location"}}), () => {});
      const table = tableOf(idOf(created));

      await manager.replace(
        idOf(created),
        withShape(
          {place: {type: "location"}},
          {indexes: [{definition: {place: "2dsphere"}, options: {}}]}
        ),
        () => {}
      );
      expect(await indexes(table)).toHaveLength(1);

      await manager.replace(idOf(created), withShape({place: {type: "location"}}), () => {});
      expect(await indexes(table)).toEqual([]);
    });
  });

  describe("type changes", () => {
    const withShape = (properties: object = {}, extra: object = {}) =>
      bucket({
        properties: {id: {type: "uuid", options: {generated: true}}, ...properties},
        ...extra
      });

    const rowsOf = async (table: string, select: string) =>
      (await pool.query(`SELECT ${select} FROM "${table}" ORDER BY 1`)).rows;

    it("should convert existing values to the new column type and clear what does not fit", async () => {
      const created = await manager.create(withShape({n: {type: "string"}}), () => {});
      const table = tableOf(idOf(created));
      await pool.query(`INSERT INTO "${table}" (n) VALUES ('12'), ('abc'), ('4.5'), (NULL)`);

      await manager.replace(idOf(created), withShape({n: {type: "number"}}), () => {});

      expect((await columns(table)).find(c => c.column_name == "n").data_type).toBe(
        "double precision"
      );
      expect((await rowsOf(table, "n")).map(row => row.n)).toEqual([4.5, 12, null, null]);
    });

    it.each([
      ["number", "string", "double precision", "7.5", "7.5"],
      ["boolean", "string", "boolean", "true", "true"],
      ["string", "boolean", "text", "true", true],
      ["string", "date", "text", "2024-02-03T04:05:06Z", new Date("2024-02-03T04:05:06Z")]
    ])("should convert %s to %s", async (from, to, sqlType, input, output) => {
      const created = await manager.create(withShape({v: {type: from}}), () => {});
      const table = tableOf(idOf(created));
      await pool.query(`INSERT INTO "${table}" (v) VALUES ($1::${sqlType})`, [input]);

      await manager.replace(idOf(created), withShape({v: {type: to}}), () => {});

      expect((await rowsOf(table, "v"))[0].v).toEqual(output);
    });

    it("should keep the values and the enum when the column type stays the same", async () => {
      const created = await manager.create(
        withShape({kind: {type: "string", enum: ["a", "b"]}}),
        () => {}
      );
      const table = tableOf(idOf(created));
      await pool.query(`INSERT INTO "${table}" (kind) VALUES ('a')`);

      await manager.replace(
        idOf(created),
        withShape({kind: {type: "textarea", enum: ["a", "b"]}}),
        () => {}
      );

      expect((await rowsOf(table, "kind"))[0].kind).toBe("a");
      await expect(pool.query(`INSERT INTO "${table}" (kind) VALUES ('c')`)).rejects.toMatchObject({
        code: "23514"
      });
    });

    it("should keep the enum check when the column is converted", async () => {
      const created = await manager.create(
        withShape({kind: {type: "string", enum: ["1", "2"]}}),
        () => {}
      );
      const table = tableOf(idOf(created));

      await manager.replace(
        idOf(created),
        withShape({kind: {type: "number", enum: [1, 2]}}),
        () => {}
      );

      await pool.query(`INSERT INTO "${table}" (kind) VALUES (2)`);
      await expect(pool.query(`INSERT INTO "${table}" (kind) VALUES (3)`)).rejects.toMatchObject({
        code: "23514"
      });
    });

    it("should convert the items of an array", async () => {
      const created = await manager.create(
        withShape({scores: {type: "array", items: {type: "string"}}}),
        () => {}
      );
      const table = tableOf(idOf(created));
      const {rows} = await pool.query(`INSERT INTO "${table}" DEFAULT VALUES RETURNING id`);
      await pool.query(`INSERT INTO "${table}__scores" VALUES ($1, 0, '3'), ($1, 1, '4.5')`, [
        rows[0].id
      ]);

      await manager.replace(
        idOf(created),
        withShape({scores: {type: "array", items: {type: "number"}}}),
        () => {}
      );

      expect((await rowsOf(`${table}__scores`, "_value")).map(row => row._value)).toEqual([3, 4.5]);
    });

    it("should report items that cannot be converted instead of losing them", async () => {
      const created = await manager.create(
        withShape({scores: {type: "array", items: {type: "string"}}}),
        () => {}
      );
      const table = tableOf(idOf(created));
      const {rows} = await pool.query(`INSERT INTO "${table}" DEFAULT VALUES RETURNING id`);
      await pool.query(`INSERT INTO "${table}__scores" VALUES ($1, 0, '3'), ($1, 1, 'x')`, [
        rows[0].id
      ]);

      await expect(
        manager.replace(
          idOf(created),
          withShape({scores: {type: "array", items: {type: "number"}}}),
          () => {}
        )
      ).rejects.toThrow(/contains null values/);

      expect((await rowsOf(`${table}__scores`, "_value")).map(row => row._value)).toEqual([
        "3",
        "x"
      ]);
      expect((await buckets.findById(idOf(created))).properties.scores.items.type).toBe("string");
    });

    it("should drop what a structure change leaves behind and keep the other data", async () => {
      const created = await manager.create(
        withShape({
          note: {type: "string"},
          address: {type: "object", properties: {city: {type: "string"}}}
        }),
        () => {}
      );
      const table = tableOf(idOf(created));
      await pool.query(`INSERT INTO "${table}" (note, address__city) VALUES ('keep', 'Rome')`);

      await manager.replace(
        idOf(created),
        withShape({note: {type: "string"}, address: {type: "string"}}),
        () => {}
      );

      expect(await rowsOf(table, "note, address")).toEqual([{note: "keep", address: null}]);
      expect((await columns(table)).map(c => c.column_name)).toEqual(["address", "id", "note"]);
    });

    it("should turn a onetoone relation into a link table and back", async () => {
      const target = await manager.create(withShape({}), () => {});
      const relation = (relationType: string) => ({
        type: "relation",
        bucketId: String(idOf(target)),
        relationType
      });
      const created = await manager.create(withShape({link: relation("onetoone")}), () => {});
      const table = tableOf(idOf(created));

      await manager.replace(idOf(created), withShape({link: relation("onetomany")}), () => {});
      expect(await tablesOfBucket(table)).toEqual([table, `${table}__link`]);
      expect((await columns(table)).map(c => c.column_name)).toEqual(["id"]);

      await manager.replace(idOf(created), withShape({link: relation("onetoone")}), () => {});
      expect(await tablesOfBucket(table)).toEqual([table]);
      expect((await columns(table)).map(c => c.column_name)).toEqual(["id", "link"]);
    });

    it("should recreate a child table whose key changes kind and keep the rest", async () => {
      const created = await manager.create(
        withShape({tags: {type: "array", items: {type: "string"}}, note: {type: "string"}}),
        () => {}
      );
      const table = tableOf(idOf(created));
      const {rows} = await pool.query(`INSERT INTO "${table}" (note) VALUES ('keep') RETURNING id`);
      await pool.query(`INSERT INTO "${table}__tags" VALUES ($1, 0, 'a')`, [rows[0].id]);

      await manager.replace(
        idOf(created),
        withShape({tags: {type: "string", options: {translate: true}}, note: {type: "string"}}),
        () => {}
      );

      expect((await columns(`${table}__tags`)).map(c => c.column_name)).toEqual([
        "_locale",
        "_parent",
        "_value"
      ]);
      expect((await pool.query(`SELECT 1 FROM "${table}__tags"`)).rowCount).toBe(0);
      expect((await rowsOf(table, "note"))[0].note).toBe("keep");
    });

    it("should translate and untranslate a property", async () => {
      const created = await manager.create(withShape({name: {type: "string"}}), () => {});
      const table = tableOf(idOf(created));

      await manager.replace(
        idOf(created),
        withShape({name: {type: "string", options: {translate: true}}}),
        () => {}
      );
      expect(await tablesOfBucket(table)).toEqual([table, `${table}__name`]);

      await manager.replace(idOf(created), withShape({name: {type: "string"}}), () => {});
      expect(await tablesOfBucket(table)).toEqual([table]);
      expect((await columns(table)).map(c => c.column_name)).toEqual(["id", "name"]);
    });

    it("should not run any statement for an edit that leaves the structure alone", async () => {
      const created = await manager.create(withShape({n: {type: "string"}}), () => {});
      const execute = jest.spyOn(Session.prototype, "executeStatements");

      await manager.replace(
        idOf(created),
        {...withShape({n: {type: "string", title: "N"}}), title: "Renamed", description: "x"},
        () => {}
      );

      expect(execute).toHaveBeenCalledWith([]);
      execute.mockRestore();
    });
  });

  describe("primary key changes", () => {
    const keyed = (primary: string, properties: object = {}, extra: object = {}) =>
      bucket({primary, properties, ...extra});

    const generatedUuid = {type: "uuid", options: {generated: true}};

    const rowsOf = async (table: string, select: string) =>
      (await pool.query(`SELECT ${select} FROM "${table}" ORDER BY 1`)).rows;

    const keyColumn = async (table: string) =>
      (
        await pool.query(
          `SELECT a.attname FROM pg_index i JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
           WHERE i.indrelid = to_regclass($1) AND i.indisprimary`,
          [`"${table}"`]
        )
      ).rows.map(row => row.attname);

    const columnOf = async (table: string, column: string) =>
      (await columns(table)).find(c => c.column_name == column);

    it("should turn the generation of a uuid key off and on", async () => {
      const created = await manager.create(keyed("id", {id: generatedUuid}), () => {});
      const table = tableOf(idOf(created));

      await manager.replace(idOf(created), keyed("id", {id: {type: "uuid"}}), () => {});
      expect((await columnOf(table, "id")).column_default).toBeNull();
      await expect(pool.query(`INSERT INTO "${table}" DEFAULT VALUES`)).rejects.toMatchObject({
        code: "23502"
      });

      await manager.replace(idOf(created), keyed("id", {id: generatedUuid}), () => {});
      expect((await columnOf(table, "id")).column_default).toBe("uuidv7()");
      expect(await keyColumn(table)).toEqual(["id"]);
    });

    it("should continue an identity key after the existing rows when generation is turned on", async () => {
      const created = await manager.create(keyed("n", {n: {type: "integer"}}), () => {});
      const table = tableOf(idOf(created));
      await pool.query(`INSERT INTO "${table}" (n) VALUES (5), (9)`);

      await manager.replace(
        idOf(created),
        keyed("n", {n: {type: "integer", options: {generated: true}}}),
        () => {}
      );

      expect((await columnOf(table, "n")).is_identity).toBe("YES");
      const {rows} = await pool.query(`INSERT INTO "${table}" DEFAULT VALUES RETURNING n`);
      expect(rows[0].n).toBe(10);

      await manager.replace(idOf(created), keyed("n", {n: {type: "integer"}}), () => {});
      expect((await columnOf(table, "n")).is_identity).toBe("NO");
    });

    it("should not rebuild the primary key when only its generation changes", async () => {
      const created = await manager.create(keyed("id", {id: generatedUuid}), () => {});
      const execute = jest.spyOn(Session.prototype, "executeStatements");

      await manager.replace(idOf(created), keyed("id", {id: {type: "uuid"}}), () => {});

      const statements = execute.mock.calls[0][0];
      expect(statements.some(statement => statement.includes("PRIMARY KEY"))).toBe(false);
      expect(statements.some(statement => statement.includes("DROP CONSTRAINT"))).toBe(false);
      execute.mockRestore();
    });

    it.each([
      ["uuid", "string"],
      ["string", "uuid"]
    ])("should convert a %s key to %s with its child tables and relations", async (from, to) => {
      const id = "0198a7e0-7b1c-7d2e-9f3a-4b5c6d7e8f90";
      const definition = (type: string) =>
        keyed("id", {id: {type}, tags: {type: "array", items: {type: "string"}}});
      const created = await manager.create(definition(from), () => {});
      const table = tableOf(idOf(created));
      const referrer = await manager.create(
        keyed("rid", {
          rid: generatedUuid,
          owner: {type: "relation", bucketId: String(idOf(created)), relationType: "onetoone"},
          owners: {type: "relation", bucketId: String(idOf(created)), relationType: "onetomany"}
        }),
        () => {}
      );
      const referrerTable = tableOf(idOf(referrer));
      await pool.query(`INSERT INTO "${table}" (id) VALUES ($1)`, [id]);
      await pool.query(`INSERT INTO "${table}__tags" VALUES ($1, 0, 'a')`, [id]);
      await pool.query(`INSERT INTO "${referrerTable}" (owner) VALUES ($1)`, [id]);
      const parent = await pool.query(`SELECT rid FROM "${referrerTable}"`);
      await pool.query(`INSERT INTO "${referrerTable}__owners" VALUES ($1, 0, $2)`, [
        parent.rows[0].rid,
        id
      ]);

      await manager.replace(idOf(created), definition(to), () => {});

      const expectedType = to == "string" ? "text" : "uuid";
      expect((await columnOf(table, "id")).data_type).toBe(expectedType);
      expect((await columnOf(`${table}__tags`, "_parent")).data_type).toBe(expectedType);
      expect((await columnOf(referrerTable, "owner")).data_type).toBe(expectedType);
      expect((await columnOf(`${referrerTable}__owners`, "_target")).data_type).toBe(expectedType);
      expect(String((await rowsOf(table, "id"))[0].id)).toBe(id);
      expect(String((await rowsOf(`${table}__tags`, "_parent"))[0]._parent)).toBe(id);
      expect(String((await rowsOf(referrerTable, "owner"))[0].owner)).toBe(id);
      expect(String((await rowsOf(`${referrerTable}__owners`, "_target"))[0]._target)).toBe(id);
      await expect(
        pool.query(`INSERT INTO "${table}__tags" VALUES ($1, 0, 'x')`, [
          to == "string" ? "unknown" : "0198a7e0-0000-7d2e-9f3a-4b5c6d7e8f91"
        ])
      ).rejects.toMatchObject({code: "23503"});
      expect(await keyColumn(table)).toEqual(["id"]);
    });

    it("should widen and narrow an integer key", async () => {
      const definition = (type: string) => keyed("n", {n: {type, options: {generated: true}}});
      const created = await manager.create(definition("integer"), () => {});
      const table = tableOf(idOf(created));
      await pool.query(`INSERT INTO "${table}" DEFAULT VALUES`);

      await manager.replace(idOf(created), definition("bigint"), () => {});
      expect((await columnOf(table, "n")).data_type).toBe("bigint");
      const {rows} = await pool.query(`INSERT INTO "${table}" DEFAULT VALUES RETURNING n`);
      expect(Number(rows[0].n)).toBe(2);

      await manager.replace(idOf(created), definition("integer"), () => {});
      expect((await columnOf(table, "n")).data_type).toBe("integer");
    });

    it("should refuse a key type that existing keys cannot be converted to, and change nothing", async () => {
      const definition = (type: string) => keyed("id", {id: {type}});
      const created = await manager.create(definition("uuid"), () => {});
      const table = tableOf(idOf(created));
      await pool.query(`INSERT INTO "${table}" (id) VALUES (uuidv7())`);

      await expect(
        manager.replace(idOf(created), definition("bigint"), () => {})
      ).rejects.toBeInstanceOf(BadRequestException);

      expect((await buckets.findById(idOf(created))).properties.id.type).toBe("uuid");
      expect((await columnOf(table, "id")).data_type).toBe("uuid");
      expect(await keyColumn(table)).toEqual(["id"]);
    });

    it("should change the type of an empty table's key to anything", async () => {
      const created = await manager.create(keyed("id", {id: {type: "uuid"}}), () => {});

      await manager.replace(
        idOf(created),
        keyed("id", {id: {type: "bigint", options: {generated: true}}}),
        () => {}
      );

      expect((await columnOf(tableOf(idOf(created)), "id")).data_type).toBe("bigint");
    });

    it("should make another property the key and carry the references along", async () => {
      const definition = (primary: string) =>
        keyed(
          primary,
          {
            id: primary == "id" ? generatedUuid : {type: "uuid"},
            code: {type: "string"},
            tags: {type: "array", items: {type: "string"}}
          },
          {required: ["code"]}
        );
      const created = await manager.create(definition("id"), () => {});
      const table = tableOf(idOf(created));
      const referrer = await manager.create(
        keyed("rid", {
          rid: generatedUuid,
          owner: {type: "relation", bucketId: String(idOf(created)), relationType: "onetoone"}
        }),
        () => {}
      );
      const referrerTable = tableOf(idOf(referrer));
      const first = await pool.query(`INSERT INTO "${table}" (code) VALUES ('a') RETURNING id`);
      const second = await pool.query(`INSERT INTO "${table}" (code) VALUES ('b') RETURNING id`);
      await pool.query(`INSERT INTO "${table}__tags" VALUES ($1, 0, 'x'), ($2, 0, 'y')`, [
        first.rows[0].id,
        second.rows[0].id
      ]);
      await pool.query(`INSERT INTO "${referrerTable}" (owner) VALUES ($1)`, [second.rows[0].id]);

      await manager.replace(idOf(created), definition("code"), () => {});

      expect(await keyColumn(table)).toEqual(["code"]);
      expect(
        (await rowsOf(`${table}__tags`, "_parent, _value")).map(row => [row._parent, row._value])
      ).toEqual([
        ["a", "x"],
        ["b", "y"]
      ]);
      expect((await rowsOf(referrerTable, "owner"))[0].owner).toBe("b");
      const oldKey = await columnOf(table, "id");
      expect([oldKey.data_type, oldKey.is_nullable, oldKey.column_default]).toEqual([
        "uuid",
        "YES",
        null
      ]);
      expect((await rowsOf(table, "id")).map(row => row.id).sort()).toEqual(
        [first.rows[0].id, second.rows[0].id].sort()
      );
      await expect(
        pool.query(`INSERT INTO "${table}__tags" VALUES ('zzz', 0, 'q')`)
      ).rejects.toMatchObject({code: "23503"});
      await pool.query(`DELETE FROM "${table}" WHERE code = 'b'`);
      expect((await rowsOf(referrerTable, "owner"))[0].owner).toBeNull();
    });

    it("should generate the values of a new generated key for the existing rows", async () => {
      const created = await manager.create(
        keyed("id", {
          id: generatedUuid,
          n: {type: "number"},
          tags: {type: "array", items: {type: "string"}}
        }),
        () => {}
      );
      const table = tableOf(idOf(created));
      const first = await pool.query(`INSERT INTO "${table}" DEFAULT VALUES RETURNING id`);
      await pool.query(`INSERT INTO "${table}" DEFAULT VALUES`);
      await pool.query(`INSERT INTO "${table}__tags" VALUES ($1, 0, 'x')`, [first.rows[0].id]);

      await manager.replace(
        idOf(created),
        keyed("n", {
          id: {type: "uuid"},
          n: {type: "bigint", options: {generated: true}},
          tags: {type: "array", items: {type: "string"}}
        }),
        () => {}
      );

      expect((await rowsOf(table, "n")).map(row => Number(row.n))).toEqual([1, 2]);
      const tagged = await pool.query(
        `SELECT m.id FROM "${table}__tags" t JOIN "${table}" m ON m.n = t._parent`
      );
      expect(tagged.rows).toEqual([{id: first.rows[0].id}]);
      const {rows} = await pool.query(`INSERT INTO "${table}" DEFAULT VALUES RETURNING n`);
      expect(Number(rows[0].n)).toBe(3);
    });

    it("should use a property added in the same edit as the new key", async () => {
      const created = await manager.create(keyed("id", {id: generatedUuid}), () => {});
      const table = tableOf(idOf(created));
      await pool.query(`INSERT INTO "${table}" DEFAULT VALUES`);

      await manager.replace(
        idOf(created),
        keyed("uid", {id: {type: "uuid"}, uid: generatedUuid}),
        () => {}
      );

      expect(await keyColumn(table)).toEqual(["uid"]);
      expect((await rowsOf(table, "uid")).length).toBe(1);
      expect((await rowsOf(table, "uid"))[0].uid).toBeTruthy();
    });

    it("should use a property that replaces the old key property", async () => {
      const created = await manager.create(keyed("id", {id: generatedUuid}), () => {});
      const table = tableOf(idOf(created));

      await manager.replace(idOf(created), keyed("slug", {slug: {type: "string"}}), () => {});

      expect(await keyColumn(table)).toEqual(["slug"]);
      expect((await columns(table)).map(c => c.column_name)).toEqual(["slug"]);
    });

    it("should leave the definition and the structure alone when the new key has duplicates", async () => {
      const definition = (primary: string) =>
        keyed(primary, {
          id: primary == "id" ? generatedUuid : {type: "uuid"},
          code: {type: "string"}
        });
      const created = await manager.create(definition("id"), () => {});
      const table = tableOf(idOf(created));
      await pool.query(`INSERT INTO "${table}" (code) VALUES ('same'), ('same')`);

      await expect(
        manager.replace(idOf(created), definition("code"), () => {})
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(await keyColumn(table)).toEqual(["id"]);
      expect((await buckets.findById(idOf(created))).primary).toBe("id");
      expect((await rowsOf(table, "code")).map(row => row.code)).toEqual(["same", "same"]);
      const leftovers = await pool.query(
        "SELECT proname FROM pg_proc WHERE proname = 'spica_map_key'"
      );
      expect(leftovers.rowCount).toBe(0);
    });

    it("should follow a key type change through a relation to the bucket itself", async () => {
      const id = (await pool.query("SELECT uuidv7() AS id")).rows[0].id as string;
      const definition = (type: string) =>
        keyed(
          "id",
          {id: {type}, parent: {type: "relation", bucketId: id, relationType: "onetoone"}},
          {_id: id}
        );
      const created = await manager.create(definition("uuid"), () => {});
      const table = tableOf(idOf(created));
      const key = "0198a7e0-7b1c-7d2e-9f3a-4b5c6d7e8f90";
      await pool.query(`INSERT INTO "${table}" (id) VALUES ($1)`, [key]);
      await pool.query(`INSERT INTO "${table}" (id, parent) VALUES (uuidv7(), $1)`, [key]);

      await manager.replace(idOf(created), definition("string"), () => {});

      expect((await columnOf(table, "parent")).data_type).toBe("text");
      const linked = await pool.query(`SELECT 1 FROM "${table}" WHERE parent = $1`, [key]);
      expect(linked.rowCount).toBe(1);
    });
  });

  describe("drop", () => {
    it("should delete the definition and drop the table", async () => {
      const created = await manager.create(bucket(), () => {});
      const onSaved = jest.fn();

      const dropped = await manager.drop(idOf(created), onSaved);

      expect(dropped).toEqual(created);
      expect(onSaved).toHaveBeenCalledWith(created);
      expect(await buckets.findById(idOf(created))).toBeNull();
      expect(await tables()).not.toContain(tableOf(idOf(created)));
    });

    it("should resolve to null without notifying when the bucket does not exist", async () => {
      const created = await manager.create(bucket(), () => {});
      await manager.drop(idOf(created), () => {});
      const onSaved = jest.fn();

      expect(await manager.drop(idOf(created), onSaved)).toBeNull();
      expect(onSaved).not.toHaveBeenCalled();
    });
  });
});
