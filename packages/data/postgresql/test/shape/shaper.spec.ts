import {definition, shapeWith, uuid} from "./support.js";

const ID = "0198a7e0-7b1c-7d2e-9f3a-4b5c6d7e8f90";
const TARGET = "0198a7e0-7b1c-7d2e-9f3a-4b5c6d7e8f91";

const shape = (properties: object, rowSet: any, extra: object = {}, locale?: any) =>
  shapeWith({[ID]: definition(properties, extra)}, ID, rowSet, locale);

describe("BucketShaper", () => {
  describe("scalars", () => {
    const properties = {
      title: {type: "string"},
      count: {type: "number"},
      done: {type: "boolean"},
      at: {type: "date"},
      payload: {type: "json"},
      place: {type: "location", locationType: "Point"}
    };

    it("should place every column under its property, with the key under its own name", () => {
      const at = new Date("2024-05-06T07:08:09.123Z");

      expect(
        shape(properties, {
          main: {
            id: uuid(1),
            title: "a",
            count: 2.5,
            done: false,
            at,
            payload: {x: [1, {y: null}]},
            place: {x: 29, y: 41}
          }
        })
      ).toEqual({
        id: uuid(1),
        title: "a",
        count: 2.5,
        done: false,
        at: "2024-05-06T07:08:09.123Z",
        payload: {x: [1, {y: null}]},
        place: {type: "Point", coordinates: [29, 41]}
      });
    });

    it("should emit null for NULL columns and nothing else", () => {
      const document = shape(properties, {main: {id: uuid(1)}});

      expect(document).toEqual({
        id: uuid(1),
        title: null,
        count: null,
        done: null,
        at: null,
        payload: null,
        place: null
      });
    });

    it.each([
      ["integer", 7, 7],
      ["bigint", "9007199254740993", "9007199254740993"],
      ["bigint", 5, "5"]
    ])("should keep %s keys on the wire as %p", (type, stored, expected) => {
      const document = shapeWith(
        {[ID]: {...definition({}), primary: "key", properties: {key: {type}}}},
        ID,
        {main: {key: stored}}
      );

      expect(document).toEqual({key: expected});
    });

    it("should write bigint properties as strings", () => {
      expect(shape({big: {type: "bigint"}}, {main: {id: uuid(1), big: "12"}})).toMatchObject({
        big: "12"
      });
    });
  });

  describe("objects", () => {
    const properties = {
      address: {
        type: "object",
        properties: {
          city: {type: "string"},
          geo: {type: "object", properties: {lat: {type: "number"}, lng: {type: "number"}}}
        }
      },
      free: {type: "object"}
    };

    it("should fold prefixed columns into nested objects", () => {
      expect(
        shape(properties, {
          main: {
            id: uuid(1),
            address__city: "x",
            address__geo__lat: 1,
            address__geo__lng: null,
            free: {any: 1}
          }
        })
      ).toEqual({
        id: uuid(1),
        address: {city: "x", geo: {lat: 1, lng: null}},
        free: {any: 1}
      });
    });

    it("should emit an object whose columns are all NULL as {}", () => {
      expect(shape(properties, {main: {id: uuid(1)}})).toEqual({
        id: uuid(1),
        address: {},
        free: null
      });
    });

    it("should collapse only the inner object that is empty", () => {
      expect(shape(properties, {main: {id: uuid(1), address__city: "x"}}).address).toEqual({
        city: "x",
        geo: {}
      });
    });
  });
});
