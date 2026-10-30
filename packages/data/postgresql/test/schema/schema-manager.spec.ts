import {BadRequestException} from "@nestjs/common";
import {Test, TestingModule} from "@nestjs/testing";
import {provideRepository} from "@spica-server/data";
import {DatabaseTestingModule} from "@spica-server/database-testing";
import {
  BUCKET_REPOSITORY,
  BUCKET_SCHEMA_MANAGER,
  BucketRepository,
  BucketSchemaManager
} from "@spica-server/interface-bucket";
import {PG_POOL} from "@spica-server/interface-data";
import {constraintName} from "@spica-server/data-postgresql";
import pg from "pg";

describe("PostgreSQL schema manager", () => {
  let module: TestingModule;
  let pool: pg.Pool;
  let manager: BucketSchemaManager;
  let buckets: BucketRepository;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [DatabaseTestingModule.postgres()],
      providers: [provideRepository(BUCKET_REPOSITORY), provideRepository(BUCKET_SCHEMA_MANAGER)]
    }).compile();
    await module.init();
    pool = module.get(PG_POOL);
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
      expect(await buckets.findById(created._id)).toEqual(created);
      expect(await columns(tableOf(created._id))).toEqual([
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
      expect(await constraints(tableOf(created._id))).toEqual([
        {conname: `${tableOf(created._id)}_id_pk`, contype: "p"}
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

      expect(await columns(tableOf(created._id))).toEqual([
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

      expect(await columns(tableOf(created._id))).toEqual([
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
      const table = tableOf(created._id);

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
      const table = tableOf(created._id);

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
      const table = tableOf(created._id);
      const onSaved = jest.fn();

      await manager.replace(
        created._id,
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

      expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({_id: created._id}));
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
      const table = tableOf(created._id);
      await pool.query(`INSERT INTO "${table}" (title) VALUES ('a')`);
      const onSaved = jest.fn();

      await expect(
        manager.replace(
          created._id,
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
      expect(await buckets.findById(created._id)).toEqual(created);
      expect((await columns(table)).map(c => c.column_name)).toEqual(["id", "title"]);
    });

    it("should refuse to change the primary key for now", async () => {
      const created = await manager.create(bucket(), () => {});

      await expect(
        manager.replace(
          created._id,
          bucket({properties: {id: {type: "uuid"}, title: {type: "string"}}}),
          () => {}
        )
      ).rejects.toThrow("Changing the primary key is not supported yet.");
    });

    it("should refuse to retype a property into another column type for now", async () => {
      const created = await manager.create(
        bucket({properties: {id: {type: "uuid", options: {generated: true}}, n: {type: "string"}}}),
        () => {}
      );

      await expect(
        manager.replace(
          created._id,
          bucket({
            properties: {id: {type: "uuid", options: {generated: true}}, n: {type: "number"}}
          }),
          () => {}
        )
      ).rejects.toThrow(
        "Changing the type or the translation of a property is not supported yet: n."
      );
    });

    it("should accept a retype that keeps the column type", async () => {
      const created = await manager.create(
        bucket({properties: {id: {type: "uuid", options: {generated: true}}, n: {type: "string"}}}),
        () => {}
      );

      await manager.replace(
        created._id,
        bucket({
          properties: {id: {type: "uuid", options: {generated: true}}, n: {type: "textarea"}}
        }),
        () => {}
      );

      expect((await columns(tableOf(created._id))).map(c => c.data_type)).toEqual(["uuid", "text"]);
    });

    it("should create the table of a bucket that was saved before it had one", async () => {
      const legacy = await buckets.insert(bucket());

      await manager.replace(legacy._id, bucket(), () => {});

      expect((await columns(tableOf(legacy._id))).map(c => c.column_name)).toEqual(["id", "title"]);
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
      const table = tableOf(created._id);

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
      const table = tableOf(created._id);
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
      const table = tableOf(created._id);
      const {rows} = await pool.query(`INSERT INTO "${table}" DEFAULT VALUES RETURNING id`);

      await expect(
        pool.query(`INSERT INTO "${table}__kinds" VALUES ($1, 0, 'c')`, [rows[0].id])
      ).rejects.toMatchObject({code: "23514"});
    });

    it("should add and drop columns and child tables as properties come and go", async () => {
      const created = await manager.create(withShape({tags: shape.tags}), () => {});
      const table = tableOf(created._id);

      await manager.replace(
        created._id,
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
        created._id,
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
      const table = tableOf(created._id);

      await manager.replace(
        created._id,
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
      const table = tableOf(created._id);

      expect((await indexes(`${table}__tags`)).map(index => index.indexname)).toEqual([
        constraintName(`${table}__tags`, ["_value"], "uq")
      ]);

      await manager.replace(created._id, withShape({tags: shape.tags}), () => {});

      expect(await indexes(`${table}__tags`)).toEqual([]);
    });

    it("should refuse to turn a structure into another one for now", async () => {
      const created = await manager.create(withShape({address: shape.address}), () => {});

      await expect(
        manager.replace(created._id, withShape({address: {type: "string"}}), () => {})
      ).rejects.toThrow(
        "Changing the type or the translation of a property is not supported yet: address."
      );
      await expect(
        manager.replace(
          created._id,
          withShape({address: shape.address, tags: shape.tags}),
          () => {}
        )
      ).resolves.toBeTruthy();
    });

    it("should drop the child tables together with the bucket", async () => {
      const created = await manager.create(withShape(shape), () => {});

      await manager.drop(created._id, () => {});

      expect(await tablesOfBucket(tableOf(created._id))).toEqual([]);
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
        keyed({owner: relation(target._id, "onetoone")}),
        () => {}
      );
      const table = tableOf(created._id);

      expect((await columns(table)).find(c => c.column_name == "owner")).toMatchObject({
        data_type: "bigint",
        is_nullable: "YES"
      });
      expect(await foreignKeys(table)).toEqual([
        [constraintName(table, ["owner"], "fk"), tableOf(target._id), "n"]
      ]);
    });

    it("should set the reference to null when the related row goes, unless it is required", async () => {
      const target = await manager.create(keyed({}), () => {});
      const targetTable = tableOf(target._id);
      const optional = await manager.create(
        keyed({owner: relation(target._id, "onetoone")}),
        () => {}
      );
      const required = await manager.create(
        keyed({owner: relation(target._id, "onetoone")}, {required: ["owner"]}),
        () => {}
      );
      const {rows} = await pool.query(`INSERT INTO "${targetTable}" DEFAULT VALUES RETURNING id`);
      await pool.query(`INSERT INTO "${tableOf(optional._id)}" (owner) VALUES ($1)`, [rows[0].id]);

      await pool.query(`DELETE FROM "${targetTable}" WHERE id = $1`, [rows[0].id]);

      const left = await pool.query(`SELECT owner FROM "${tableOf(optional._id)}"`);
      expect(left.rows).toEqual([{owner: null}]);
      await pool.query(`INSERT INTO "${targetTable}" (id) VALUES ($1)`, [rows[0].id]);
      await pool.query(`INSERT INTO "${tableOf(required._id)}" (owner) VALUES ($1)`, [rows[0].id]);
      await expect(
        pool.query(`DELETE FROM "${targetTable}" WHERE id = $1`, [rows[0].id])
      ).rejects.toMatchObject({code: "23503"});
    });

    it("should link a onetomany relation through an ordered link table", async () => {
      const target = await manager.create(keyed({}), () => {});
      const created = await manager.create(
        keyed({friends: relation(target._id, "onetomany")}),
        () => {}
      );
      const table = tableOf(created._id);
      const link = `${table}__friends`;

      expect((await columns(link)).map(c => [c.column_name, c.data_type])).toEqual([
        ["_parent", "uuid"],
        ["_position", "integer"],
        ["_target", "uuid"]
      ]);
      expect(await foreignKeys(link)).toEqual(
        [
          [constraintName(link, ["_parent"], "fk"), table, "c"],
          [constraintName(link, ["_target"], "fk"), tableOf(target._id), "c"]
        ].sort((a, b) => (a[0] < b[0] ? -1 : 1))
      );

      const targets = await pool.query(
        `INSERT INTO "${tableOf(target._id)}" DEFAULT VALUES RETURNING id`
      );
      const parent = await pool.query(`INSERT INTO "${table}" DEFAULT VALUES RETURNING id`);
      await pool.query(`INSERT INTO "${link}" VALUES ($1, 0, $2)`, [
        parent.rows[0].id,
        targets.rows[0].id
      ]);
      await pool.query(`DELETE FROM "${tableOf(target._id)}"`);
      expect((await pool.query(`SELECT 1 FROM "${link}"`)).rowCount).toBe(0);
    });

    it("should allow a bucket to relate to itself", async () => {
      const id = "0198a7e0-7b1c-7d2e-9f3a-4b5c6d7e8f90";
      const created = await manager.create(
        keyed({parent: relation(id, "onetoone")}, {_id: id}),
        () => {}
      );

      expect(await foreignKeys(tableOf(created._id))).toEqual([
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
          boss: {type: "object", properties: {who: relation(target._id, "onetoone")}},
          lines: {
            type: "array",
            items: {type: "object", properties: {product: relation(target._id, "onetoone")}}
          },
          crew: {type: "object", properties: {members: relation(target._id, "onetomany")}}
        }),
        () => {}
      );
      const table = tableOf(created._id);

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
      const table = tableOf(created._id);

      await manager.replace(
        created._id,
        keyed({one: relation(first._id, "onetoone"), many: relation(first._id, "onetomany")}),
        () => {}
      );
      expect(await foreignKeys(table)).toEqual([
        [constraintName(table, ["one"], "fk"), tableOf(first._id), "n"]
      ]);
      expect(await tablesOfBucket(table)).toEqual([table, `${table}__many`]);

      await manager.replace(
        created._id,
        keyed({one: relation(second._id, "onetoone"), many: relation(second._id, "onetomany")}),
        () => {}
      );
      expect(await foreignKeys(table)).toEqual([
        [constraintName(table, ["one"], "fk"), tableOf(second._id), "n"]
      ]);
      expect((await foreignKeys(`${table}__many`)).map(key => key[1]).sort()).toEqual(
        [table, tableOf(second._id)].sort()
      );

      await manager.replace(created._id, keyed({}), () => {});
      expect(await foreignKeys(table)).toEqual([]);
      expect(await tablesOfBucket(table)).toEqual([table]);
    });

    it("should refuse to change the cardinality of a relation for now", async () => {
      const target = await manager.create(keyed({}), () => {});
      const created = await manager.create(
        keyed({link: relation(target._id, "onetoone")}),
        () => {}
      );

      await expect(
        manager.replace(created._id, keyed({link: relation(target._id, "onetomany")}), () => {})
      ).rejects.toThrow(
        "Changing the type or the translation of a property is not supported yet: link."
      );
    });

    it("should remove the relations that point at a bucket when it is dropped", async () => {
      const target = await manager.create(keyed({}), () => {});
      const other = await manager.create(keyed({}), () => {});
      const referencing = await manager.create(
        keyed(
          {
            title: {type: "string"},
            one: relation(target._id, "onetoone"),
            keep: relation(other._id, "onetoone"),
            many: relation(target._id, "onetomany"),
            boss: {
              type: "object",
              required: ["who"],
              properties: {who: relation(target._id, "onetoone"), name: {type: "string"}}
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
      const table = tableOf(referencing._id);
      const changed = jest.fn();
      const onSaved = jest.fn();

      await manager.drop(target._id, onSaved, changed);

      expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({_id: target._id}));
      expect(await tablesOfBucket(tableOf(target._id))).toEqual([]);
      expect(await tablesOfBucket(table)).toEqual([table]);
      expect((await columns(table)).map(c => c.column_name)).toEqual([
        "boss__name",
        "id",
        "keep",
        "title"
      ]);
      expect(await foreignKeys(table)).toEqual([
        [constraintName(table, ["keep"], "fk"), tableOf(other._id), "n"]
      ]);
      const stored = await buckets.findById(referencing._id);
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
      expect(changed).toHaveBeenCalledWith(expect.objectContaining({_id: referencing._id}));
    });

    it("should leave everything alone when a drop fails", async () => {
      const target = await manager.create(keyed({}), () => {});
      const referencing = await manager.create(
        keyed({one: relation(target._id, "onetoone")}),
        () => {}
      );
      await pool.query(`ALTER TABLE "${tableOf(referencing._id)}" ADD COLUMN stray text`);
      await pool.query(`CREATE TABLE "${tableOf(target._id)}__blocker" (x int)`);
      await pool.query(
        `CREATE FUNCTION fail_drop() RETURNS event_trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'no drops'; END $$`
      );
      await pool.query(
        `CREATE EVENT TRIGGER fail_drop_trigger ON sql_drop EXECUTE FUNCTION fail_drop()`
      );

      try {
        await expect(manager.drop(target._id, () => {})).rejects.toBeDefined();
      } finally {
        await pool.query(`DROP EVENT TRIGGER fail_drop_trigger`);
        await pool.query(`DROP FUNCTION fail_drop()`);
      }

      expect(await buckets.findById(target._id)).toBeTruthy();
      expect((await buckets.findById(referencing._id)).properties).toHaveProperty("one");
      expect((await columns(tableOf(referencing._id))).map(c => c.column_name)).toContain("one");
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
      const table = tableOf(created._id);

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
      const table = tableOf(created._id);

      await manager.replace(created._id, withShape({name: translated}), () => {});
      expect(await tablesOfBucket(table)).toEqual([table, `${table}__name`]);

      await manager.replace(created._id, withShape({}), () => {});
      expect(await tablesOfBucket(table)).toEqual([table]);
    });

    it("should refuse to translate or untranslate an existing property for now", async () => {
      const created = await manager.create(withShape({name: {type: "string"}}), () => {});

      await expect(
        manager.replace(created._id, withShape({name: translated}), () => {})
      ).rejects.toThrow(
        "Changing the type or the translation of a property is not supported yet: name."
      );

      const translatedBucket = await manager.create(withShape({name: translated}), () => {});
      await expect(
        manager.replace(translatedBucket._id, withShape({name: {type: "string"}}), () => {})
      ).rejects.toThrow(
        "Changing the type or the translation of a property is not supported yet: name."
      );
    });
  });

  describe("drop", () => {
    it("should delete the definition and drop the table", async () => {
      const created = await manager.create(bucket(), () => {});
      const onSaved = jest.fn();

      const dropped = await manager.drop(created._id, onSaved);

      expect(dropped).toEqual(created);
      expect(onSaved).toHaveBeenCalledWith(created);
      expect(await buckets.findById(created._id)).toBeNull();
      expect(await tables()).not.toContain(tableOf(created._id));
    });

    it("should resolve to null without notifying when the bucket does not exist", async () => {
      const created = await manager.create(bucket(), () => {});
      await manager.drop(created._id, () => {});
      const onSaved = jest.fn();

      expect(await manager.drop(created._id, onSaved)).toBeNull();
      expect(onSaved).not.toHaveBeenCalled();
    });
  });
});
