import {definition, shapeWith, uuid} from "./support.js";

const ID = "0198a7e0-7b1c-7d2e-9f3a-4b5c6d7e8f90";
const TARGET = "0198a7e0-7b1c-7d2e-9f3a-4b5c6d7e8f91";

const shape = (properties: object, rowSet: any, locale?: any) =>
  shapeWith({[ID]: definition(properties)}, ID, rowSet, locale);

describe("arrays", () => {
  const properties = {
    tags: {type: "array", items: {type: "string"}},
    picks: {type: "multiselect", items: {type: "string", enum: ["a", "b", "c"]}},
    lines: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: {type: "string"},
          size: {type: "object", properties: {w: {type: "number"}, h: {type: "number"}}}
        }
      }
    },
    loose: {type: "array"}
  };

  it("should order scalar items by position", () => {
    const document = shape(properties, {
      main: {id: uuid(1)},
      children: {
        tags: [
          {_parent: uuid(1), _position: 1, _value: "second"},
          {_parent: uuid(1), _position: 0, _value: "first"},
          {_parent: uuid(1), _position: 2, _value: "third"}
        ],
        picks: [
          {_parent: uuid(1), _position: 0, _value: "c"},
          {_parent: uuid(1), _position: 1, _value: "a"}
        ]
      }
    });

    expect(document.tags).toEqual(["first", "second", "third"]);
    expect(document.picks).toEqual(["c", "a"]);
  });

  it("should build item objects from the columns of the child table", () => {
    const document = shape(properties, {
      main: {id: uuid(1)},
      children: {
        lines: [
          {_parent: uuid(1), _position: 1, name: "b", size__w: null, size__h: null},
          {_parent: uuid(1), _position: 0, name: "a", size__w: 2, size__h: 3}
        ]
      }
    });

    expect(document.lines).toEqual([
      {name: "a", size: {w: 2, h: 3}},
      {name: "b", size: {}}
    ]);
  });

  it("should emit [] when there are no child rows and null for an unset jsonb array", () => {
    expect(shape(properties, {main: {id: uuid(1)}})).toMatchObject({
      tags: [],
      picks: [],
      lines: [],
      loose: null
    });
  });

  it("should return a jsonb array as stored", () => {
    expect(shape(properties, {main: {id: uuid(1), loose: [1, "a", {b: null}]}}).loose).toEqual([
      1,
      "a",
      {b: null}
    ]);
  });

  it("should write bigint items as strings", () => {
    const document = shape(
      {ids: {type: "array", items: {type: "bigint"}}},
      {main: {id: uuid(1)}, children: {ids: [{_parent: uuid(1), _position: 0, _value: "7"}]}}
    );

    expect(document.ids).toEqual(["7"]);
  });
});

describe("relations", () => {
  const target = definition({name: {type: "string"}});
  const owner = definition({
    one: {type: "relation", bucketId: TARGET, relationType: "onetoone"},
    many: {type: "relation", bucketId: TARGET, relationType: "onetomany"},
    parent: {type: "relation", bucketId: ID, relationType: "onetoone"}
  });
  const buckets = {[ID]: owner, [TARGET]: target};
  const shapeOwner = (rowSet: any, locale?: any) => shapeWith(buckets, ID, rowSet, locale);

  it("should return keys for relations that are not resolved", () => {
    expect(
      shapeOwner({
        main: {id: uuid(1), one: uuid(10), parent: null},
        children: {
          many: [
            {_parent: uuid(1), _position: 1, _target: uuid(12)},
            {_parent: uuid(1), _position: 0, _target: uuid(11)}
          ]
        }
      })
    ).toEqual({id: uuid(1), one: uuid(10), many: [uuid(11), uuid(12)], parent: null});
  });

  it("should emit null and [] for unset relations", () => {
    expect(shapeOwner({main: {id: uuid(1)}})).toEqual({
      id: uuid(1),
      one: null,
      many: [],
      parent: null
    });
  });

  it("should replace resolved relations with the target document under the target's own key", () => {
    expect(
      shapeOwner({
        main: {id: uuid(1), one: uuid(10), parent: uuid(1)},
        children: {
          many: [
            {_parent: uuid(1), _position: 1, _target: uuid(12)},
            {_parent: uuid(1), _position: 0, _target: uuid(11)}
          ]
        },
        joined: {
          one: {main: {id: uuid(10), name: "ten"}},
          many: [{main: {id: uuid(12), name: "twelve"}}, {main: {id: uuid(11), name: "eleven"}}],
          parent: {main: {id: uuid(1), name: undefined}} as any
        }
      })
    ).toMatchObject({
      one: {id: uuid(10), name: "ten"},
      many: [
        {id: uuid(11), name: "eleven"},
        {id: uuid(12), name: "twelve"}
      ]
    });
  });

  it("should emit null for a resolved relation without a target", () => {
    expect(
      shapeOwner({main: {id: uuid(1), one: uuid(10)}, joined: {one: null, many: []}})
    ).toMatchObject({one: null, many: []});
  });

  it("should resolve nested relations and a relation to the bucket itself", () => {
    const nested = shapeOwner({
      main: {id: uuid(1), parent: uuid(2)},
      joined: {
        parent: {
          main: {id: uuid(2), parent: uuid(3)},
          joined: {parent: {main: {id: uuid(3), parent: null}}}
        }
      }
    });

    expect(nested.parent.id).toBe(uuid(2));
    expect(nested.parent.parent).toMatchObject({id: uuid(3), parent: null});
  });

  it("should resolve relations inside array items by key", () => {
    const holder = definition({
      lines: {
        type: "array",
        items: {
          type: "object",
          properties: {pick: {type: "relation", bucketId: TARGET, relationType: "onetoone"}}
        }
      }
    });

    const document = shapeWith({[ID]: holder, [TARGET]: target}, ID, {
      main: {id: uuid(1)},
      children: {
        lines: [
          {_parent: uuid(1), _position: 0, pick: uuid(10)},
          {_parent: uuid(1), _position: 1, pick: uuid(11)}
        ]
      },
      joined: {
        "lines.pick": [{main: {id: uuid(11), name: "b"}}, {main: {id: uuid(10), name: "a"}}]
      }
    });

    expect(document.lines.map((line: any) => line.pick.name)).toEqual(["a", "b"]);
  });

  it("should localize resolved documents with the same locale", () => {
    const translatedTarget = definition({title: {type: "string", options: {translate: true}}});

    const document = shapeWith(
      {
        [ID]: definition({one: {type: "relation", bucketId: TARGET, relationType: "onetoone"}}),
        [TARGET]: translatedTarget
      },
      ID,
      {
        main: {id: uuid(1), one: uuid(10)},
        joined: {
          one: {
            main: {id: uuid(10)},
            children: {
              title: [
                {_parent: uuid(10), _locale: "en_US", _value: "hello"},
                {_parent: uuid(10), _locale: "tr_TR", _value: "merhaba"}
              ]
            }
          }
        }
      },
      {best: "tr_TR", fallback: "en_US"}
    );

    expect(document.one.title).toBe("merhaba");
  });
});

describe("translations", () => {
  const properties = {
    title: {type: "string", options: {translate: true}},
    views: {type: "number", options: {translate: true}},
    meta: {type: "object", properties: {label: {type: "string", options: {translate: true}}}}
  };
  const rowSet = {
    main: {id: uuid(1)},
    children: {
      title: [
        {_parent: uuid(1), _locale: "en_US", _value: "hello"},
        {_parent: uuid(1), _locale: "tr_TR", _value: "merhaba"}
      ],
      views: [{_parent: uuid(1), _locale: "en_US", _value: 3}],
      "meta.label": [{_parent: uuid(1), _locale: "en_US", _value: "L"}]
    }
  };

  it("should return every locale when none is requested", () => {
    expect(shape(properties, rowSet)).toEqual({
      id: uuid(1),
      title: {en_US: "hello", tr_TR: "merhaba"},
      views: {en_US: 3},
      meta: {label: {en_US: "L"}}
    });
  });

  it("should return {} for a property without translations", () => {
    expect(shape(properties, {main: {id: uuid(1)}})).toMatchObject({title: {}, views: {}});
  });

  it("should pick the requested locale, then the fallback, then every locale", () => {
    const localized = shape(properties, rowSet, {best: "tr_TR", fallback: "en_US"});

    expect(localized.title).toBe("merhaba");
    expect(localized.views).toBe(3);

    expect(shape(properties, rowSet, {best: "de_DE", fallback: "en_US"}).title).toBe("hello");
    expect(shape(properties, rowSet, {best: "de_DE", fallback: "fr_FR"}).title).toEqual({
      en_US: "hello",
      tr_TR: "merhaba"
    });
  });

  it("should not localize a translated property nested in an object, as MongoDB does", () => {
    expect(shape(properties, rowSet, {best: "en_US", fallback: "en_US"}).meta).toEqual({
      label: {en_US: "L"}
    });
  });
});
