import {RepresentativeManager} from "@spica-server/representative";
import fs from "fs";
import path from "path";

describe("Representative", () => {
  const cwd = path.join(process.cwd(), "representatives");
  const representative: RepresentativeManager = new RepresentativeManager(cwd);

  afterEach(() => {
    fs.rmdirSync(cwd, {recursive: true});
  });

  describe("write", () => {
    it("should write yaml", async () => {
      await representative.write("module1", "id1", "schema", {write_me: "ok"}, "yaml");

      const directory = path.join(cwd, "module1", "id1");
      expect(fs.existsSync(directory)).toEqual(true);

      const fileNames = fs.readdirSync(directory);
      expect(fileNames).toEqual(["schema.yaml"]);

      const filePath = path.join(directory, "schema.yaml");
      const fileContent = fs.readFileSync(filePath);

      expect(fileContent.toString()).toEqual("write_me: ok\n");
    });

    it("should write js file", async () => {
      await representative.write("module1", "id1", "index", "console.log()", "js");

      const fileContent = fs.readFileSync(path.join(cwd, "module1", "id1", "index.js"));

      expect(fileContent.toString()).toEqual("console.log()");
    });

    it("should write json file", async () => {
      await representative.write("module1", "id1", "index", {imjson: "ok"}, "json");

      const fileContent = fs.readFileSync(path.join(cwd, "module1", "id1", "index.json"));

      expect(fileContent.toString()).toEqual('{"imjson":"ok"}');
    });

    it("should write env file", async () => {
      await representative.write("module1", "id1", "env", {APIKEY: "SECRET"}, "env");

      const fileContent = fs.readFileSync(path.join(cwd, "module1", "id1", "env.env"));

      expect(fileContent.toString()).toEqual("APIKEY=SECRET");
    });
  });

  describe("read", () => {
    it("should read content of specific file", async () => {
      await representative.write("module1", "id1", "schema", {title: "hi"}, "yaml");
      await representative.write("module1", "id1", "index", "console.log(123)", "js");

      const resource = await representative.readResource("module1", "id1", ["schema.yaml"]);
      expect(resource).toEqual({
        _id: "id1",
        contents: {
          schema: {title: "hi"}
        }
      });
    });

    it("should read content of multiple files", async () => {
      await representative.write(
        "module1",
        "id1",
        "package",
        {dependencies: {dep1: "1.1"}},
        "json"
      );
      await representative.write("module1", "id1", "schema", {title: "hi"}, "yaml");
      await representative.write("module1", "id1", "index", "console.log(123)", "js");
      await representative.write("module1", "id1", "env", {APIKEY: "SECRET"}, "env");

      const resource = await representative.readResource("module1", "id1");
      expect(resource).toEqual({
        _id: "id1",
        contents: {
          package: {dependencies: {dep1: "1.1"}},
          schema: {title: "hi"},
          index: "console.log(123)",
          env: {
            APIKEY: "SECRET"
          }
        }
      });
    });

    it("should read all contents of module", async () => {
      await representative.write(
        "module1",
        "id1",
        "package",
        {dependencies: {dep1: "1.1"}},
        "json"
      );
      await representative.write("module1", "id1", "schema", {title: "hi"}, "yaml");
      await representative.write("module1", "id1", "index", "console.log(123)", "js");

      const contents = await representative.read("module1", () => true);
      expect(contents).toEqual([
        {
          _id: "id1",
          contents: {
            package: {dependencies: {dep1: "1.1"}},
            schema: {title: "hi"},
            index: "console.log(123)"
          }
        }
      ]);
    });
  });
});
