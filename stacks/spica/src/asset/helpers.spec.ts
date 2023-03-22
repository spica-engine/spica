import {ConfigExporter, getPathsOfSchema} from "./helpers";
import {Option} from "./interfaces";

describe("Helpers", () => {
  describe("Config Exporter", () => {
    let schemas, typeLoader, propertyLoader, schemaLoader, moduleConfigExporter, configExporter;

    let module1Option: Option;

    beforeEach(() => {
      schemas = [
        {
          id: "schema1_id",
          root: {
            sub: {
              subsub: "value"
            }
          },
          root2: "value2"
        },
        {
          id: "schema2_id",
          root4: true
        }
      ];
      typeLoader = () =>
        Promise.resolve([
          {value: "string", title: "String"},
          {value: "boolean", title: "Boolean"},
          {value: "number", title: "Number"}
        ]);

      propertyLoader = async selections => {
        let schema;
        if (selections.schema == "schema1_id") {
          schema = await Promise.resolve(schemas[0]);
        } else {
          schema = await Promise.resolve(schemas[1]);
        }
        // usually we don't make the id field editable
        const copy = JSON.parse(JSON.stringify(schema));
        delete copy.id;

        return getPathsOfSchema(copy).map(prop => {
          return {
            value: prop,
            title: prop
          };
        });
      };

      schemaLoader = () =>
        Promise.resolve(
          schemas.map(s => {
            return {title: s.id, value: s.id};
          })
        );

      moduleConfigExporter = {
        moduleName: "module1",
        exporters: {
          name: "schema",
          loadOptions: schemaLoader,
          children: {
            name: "property",
            loadOptions: propertyLoader,
            children: {
              name: "type",
              loadOptions: typeLoader
            }
          }
        }
      };

      configExporter = new ConfigExporter();
      module1Option = configExporter.build(moduleConfigExporter);
    });

    it("should load first options", () => {
      delete module1Option.onSelect;
      expect(module1Option).toEqual({
        name: "module",
        title: "module1",
        value: "module1"
      });
    });

    it("should load schemas on module select", async () => {
      const schemas = await module1Option.onSelect!();
      schemas.forEach(s => delete s.onSelect);
      expect(schemas).toEqual([
        {
          name: "schema",
          value: "schema1_id",
          title: "schema1_id"
        },
        {
          name: "schema",
          value: "schema2_id",
          title: "schema2_id"
        }
      ]);
    });

    it("should load properties on select schema", async () => {
      const schemas = await module1Option.onSelect!();

      const schema1Option = schemas.find(s => s.value == "schema1_id")!;
      const schema1Properties = await schema1Option.onSelect!("schema1_id");

      schema1Properties.forEach(p => delete p.onSelect);

      expect(schema1Properties).toEqual([
        {
          name: "property",
          title: "root.sub.subsub",
          value: "root.sub.subsub"
        },
        {
          name: "property",
          title: "root2",
          value: "root2"
        }
      ]);

      const schema2Option = schemas.find(s => s.value == "schema2_id")!;
      const schema2Properties = await schema2Option.onSelect!("schema2_id");

      schema2Properties.forEach(p => delete p.onSelect);

      expect(schema2Properties).toEqual([
        {
          name: "property",
          title: "root4",
          value: "root4"
        }
      ]);
    });

    it("should load types on property select", async () => {
      const schemaOptions = await module1Option.onSelect!();
      const propertyOptions = await schemaOptions[0].onSelect!("root2");
      const types = await propertyOptions[0].onSelect!("root.sub.subsub");

      types.forEach(t => delete t.onSelect);

      expect(types).toEqual([
        {name: "type", value: "string", title: "String", isLast: true},
        {name: "type", value: "boolean", title: "Boolean", isLast: true},
        {name: "type", value: "number", title: "Number", isLast: true}
      ]);
    });
  });

  describe("get paths of schema", () => {
    it("should get paths", () => {
      expect(getPathsOfSchema({test: 123, find: {me: {here: "pls"}}})).toEqual([
        "test",
        "find.me.here"
      ]);
    });

    it("should skip array items", () => {
      expect(
        getPathsOfSchema({
          i: {am: {array: [{skip: "me"}], not: {array: 123}}},
          no: {i: {am: {not: "really"}}},
          root_array: []
        })
      ).toEqual(["i.am.array", "i.am.not.array", "no.i.am.not"]);
    });
  });
});
