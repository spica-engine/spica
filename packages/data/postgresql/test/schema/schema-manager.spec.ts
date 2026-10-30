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
      ).rejects.toThrow("Changing the type of a property is not supported yet: n.");
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
      ).rejects.toThrow("Changing the type of a property is not supported yet: address.");
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
