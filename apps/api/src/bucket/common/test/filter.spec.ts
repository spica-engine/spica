import {replaceFilterDates, constructFilterValues} from "@spica-server/bucket/common";
import {Bucket} from "@spica-server/interface/bucket";

describe("Bucket data filter", () => {
  describe("filter", () => {
    let filter;

    beforeEach(() => {
      // properties that should be kept as it is
      filter = {
        title: "hey",
        order: 1,
        products: [{type: "book", quantity: 2}],
        "meta.profile_picture": "asdqwe.com"
      };
    });

    describe("Date", () => {
      let dueDate1 = new Date(Date.UTC(2000, 0, 1, 0, 0, 0, 0));
      let dueDate2 = new Date(Date.UTC(2000, 0, 2, 0, 0, 0, 0));

      let dueString1 = "2000-01-01T00:00:00.000Z";
      let dueString2 = "2000-01-02T00:00:00.000Z";

      let schema = {
        properties: {
          due_date: {
            type: "date"
          },
          user: {
            type: "object",
            properties: {
              created_at: {
                type: "date"
              }
            }
          },
          login_dates: {
            type: "array",
            items: {
              type: "date"
            }
          },
          meta: {
            type: "object",
            properties: {
              photos: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    created_at: {
                      type: "date"
                    }
                  }
                }
              }
            }
          },
          addresses: {
            type: "relation",
            bucketId: "address_bucket_id",
            relationType: "onetomany"
          }
        }
      } as any;

      let addressSchema = {
        _id: "address_bucket_id",
        properties: {
          built_at: {
            type: "date"
          }
        }
      };

      const schemas = [schema, addressSchema];
      const resolve = id => {
        return Promise.resolve(schemas.find(s => s._id == id) as any);
      };

      it("should not construct if value is not a valid date", async () => {
        filter.due_date = "not_date";
        const replacedFilter = await replaceFilterDates(filter, schema, resolve);
        expect(replacedFilter).toEqual({...filter, due_date: "not_date"});
      });

      it("should construct date", async () => {
        filter.due_date = dueString1;
        const replacedFilter = await replaceFilterDates(filter, schema, resolve);
        expect(replacedFilter).toEqual({...filter, due_date: dueDate1});
      });

      it("should construct date in nested queries", async () => {
        filter["user.created_at"] = dueString1;
        const replacedFilter = await replaceFilterDates(filter, schema, resolve);
        expect(replacedFilter).toEqual({...filter, "user.created_at": dueDate1});
      });

      it("should construct dates in array", async () => {
        filter.login_dates = [dueString1];
        const replacedFilter = await replaceFilterDates(filter, schema, resolve);
        expect(replacedFilter).toEqual({...filter, login_dates: [dueDate1]});
      });

      it("should construct dates in object array", async () => {
        filter["meta.photos.created_at"] = dueString1;
        const replacedFilter = await replaceFilterDates(filter, schema, resolve);
        expect(replacedFilter).toEqual({...filter, "meta.photos.created_at": dueDate1});
      });

      it("should construct date array", async () => {
        filter.due_date = {$in: [dueString1, dueString2]};
        const replacedFilter = await replaceFilterDates(filter, schema, resolve);
        expect(replacedFilter).toEqual({...filter, due_date: {$in: [dueDate1, dueDate2]}});
      });

      it("should construct if date is used with operator", async () => {
        filter.due_date = {$eq: dueString1};
        const replacedFilter = await replaceFilterDates(filter, schema, resolve);
        expect(replacedFilter).toEqual({...filter, due_date: {$eq: dueDate1}});
      });

      it("should construct if date is used with multiple operators", async () => {
        filter.due_date = {$gt: dueString1, $lt: dueString2};
        const replacedFilter = await replaceFilterDates(filter, schema, resolve);
        expect(replacedFilter).toEqual({...filter, due_date: {$gt: dueDate1, $lt: dueDate2}});
      });

      it("should construct if there is a logical operator", async () => {
        const filterBefore = {
          $or: [{...filter, due_date: dueString1}, {due_date: {$gt: dueString1, $lt: dueString2}}]
        };
        const replacedFilter = await replaceFilterDates(filterBefore, schema, resolve);
        const filterAfter = {
          $or: [{...filter, due_date: dueDate1}, {due_date: {$gt: dueDate1, $lt: dueDate2}}]
        };
        expect(replacedFilter).toEqual(filterAfter);
      });

      it("should construct date for related buckets", async () => {
        filter["addresses.built_at"] = dueString1;
        const replacedFilter = await replaceFilterDates(filter, schema, resolve);
        expect(replacedFilter).toEqual({...filter, "addresses.built_at": dueDate1});
      });
    });
  });
});

describe("Reserved filter values integration", () => {
  const relationResolverMock = async () => {
    return null;
  };

  const schema: Bucket = {
    title: "test",
    description: "test",
    primary: "title",
    acl: {
      read: "true==true",
      write: "true==true"
    },
    properties: {
      title: {type: "string", options: {position: "left"}}
    }
  };

  it("convert reserved key names to their corresponding types(created_at & updated_at to date)", async () => {
    const filter = {created_at: "2000-01-01T00:00:00.000Z"};
    const date = new Date("2000-01-01T00:00:00.000Z");

    const replaced: any = await constructFilterValues(filter, schema, relationResolverMock);
    expect(replaced.created_at instanceof Date).toBeTruthy();
    expect(replaced.created_at).toEqual(date);
  });

  it("does not convert not reserved key fields", async () => {
    const filter = {created_at: "not-a-date"};

    const replaced: any = await constructFilterValues(filter, schema, relationResolverMock);
    expect(typeof replaced.created_at).toBe("string");
    expect(replaced.created_at).toBe("not-a-date");
  });

  it("type given fields should work as intended", async () => {
    const date = new Date();
    const filter = {some_date: date};

    const replaced: any = await constructFilterValues(filter, schema, relationResolverMock);
    expect(replaced.some_date instanceof Date).toBeTruthy();
    expect(replaced.some_date).toEqual(date);
  });
});
