import {ChangeTypes, ResourceType} from "@spica-server/interface/versioncontrol";
import {VCRepresentativeManager} from "@spica-server/representative";
import fs from "fs";
import path from "path";
import {skip, Subscription} from "rxjs";
import YAML from "yaml";

describe("Representative", () => {
  const cwd = path.join(process.cwd(), "representatives");
  const representative: VCRepresentativeManager = new VCRepresentativeManager(cwd);

  afterEach(() => {
    fs.rmSync(cwd, {recursive: true});
  });

  describe("write", () => {
    it("should write yaml", async () => {
      const stringified = YAML.stringify({write_me: "ok"});
      await representative.write("module1", "id1", "schema", stringified, "yaml");

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
      const stringified = JSON.stringify({imjson: "ok"});
      await representative.write("module1", "id1", "index", stringified, "json");

      const fileContent = fs.readFileSync(path.join(cwd, "module1", "id1", "index.json"));

      expect(fileContent.toString()).toEqual('{"imjson":"ok"}');
    });
  });

  describe("read", () => {
    it("should read content of files", async () => {
      const stringifiedJSON = JSON.stringify({dependencies: {dep1: "1.1"}});
      await representative.write("module1", "id1", "package", stringifiedJSON, "json");
      const stringifiedYAML = YAML.stringify({title: "hi"});
      await representative.write("module1", "id1", "schema", stringifiedYAML, "yaml");
      await representative.write("module1", "id1", "index", "console.log(123)", "js");

      const resource = await representative.readResource("module1", "id1");
      const parsed = {
        ...resource,
        contents: {
          ...resource.contents,
          package: JSON.parse(resource.contents.package),
          schema: YAML.parse(resource.contents.schema)
        }
      };
      expect(parsed).toEqual({
        _id: "id1",
        contents: {
          package: {dependencies: {dep1: "1.1"}},
          schema: {title: "hi"},
          index: "console.log(123)"
        }
      });
    });
  });

  describe("watch", () => {
    let subscription: Subscription;

    it("should track insert change type", done => {
      subscription = representative.watch("module1", ["schema.yaml"]).subscribe({
        next: change => {
          const parsedContent = YAML.parse(change.resource.content);
          change.resource = {...change.resource, content: parsedContent};

          expect(change).toEqual({
            resourceType: ResourceType.REPRESENTATIVE,
            changeType: ChangeTypes.INSERT,
            resource: {_id: "id1", content: {title: "hi"}}
          });
          subscription.unsubscribe();
          done();
        }
      });

      const stringified = YAML.stringify({title: "hi"});
      representative.write("module1", "id1", "schema", stringified, "yaml");
    });

    it("should track update change type", done => {
      subscription = representative
        .watch("module1", ["schema.yaml"])
        .pipe(skip(1))
        .subscribe({
          next: change => {
            const parsedContent = YAML.parse(change.resource.content);
            change.resource = {...change.resource, content: parsedContent};

            expect(change).toEqual({
              resourceType: ResourceType.REPRESENTATIVE,
              changeType: ChangeTypes.UPDATE,
              resource: {_id: "id1", content: {title: "hello"}}
            });
            subscription.unsubscribe();
            done();
          }
        });

      setTimeout(() => {
        const stringified = YAML.stringify({title: "hi"});
        representative.write("module1", "id1", "schema", stringified, "yaml");
      }, 1000);

      setTimeout(() => {
        const updated = YAML.stringify({title: "hello"});
        representative.write("module1", "id1", "schema", updated, "yaml");
      }, 2000);
    });

    it("should track delete change type", done => {
      subscription = representative
        .watch("module1", ["schema.yaml"])
        .pipe(skip(1))
        .subscribe({
          next: change => {
            expect(change).toEqual({
              resourceType: ResourceType.REPRESENTATIVE,
              changeType: ChangeTypes.DELETE,
              resource: {_id: "id1", content: ""}
            });
            subscription.unsubscribe();
            done();
          }
        });

      setTimeout(() => {
        const stringified = YAML.stringify({title: "hi"});
        representative.write("module1", "id1", "schema", stringified, "yaml");
      }, 1000);

      setTimeout(() => {
        representative.rm("module1", "id1");
      }, 2000);
    });
  });
});
