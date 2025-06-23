import {ObjectId} from "@spica-devkit/database";
import {ChangeTypes, ResourceType} from "@spica-server/interface/versioncontrol";
import {VCRepresentativeManager} from "@spica-server/representative";
import fs from "fs";
import path from "path";
import {skip, take} from "rxjs";
import YAML from "yaml";
import {v4 as uuidv4} from "uuid";
import os from "os";

const sleep = () => new Promise(r => setTimeout(r, 1000));

async function readResource(
  representative: VCRepresentativeManager,
  module: string,
  id: string
): Promise<any> {
  const moduleDir = representative.getModuleDir(module);
  const resourcesPath = path.join(moduleDir, id);
  const contents = {};

  if (!fs.existsSync(resourcesPath)) {
    return Promise.resolve(contents);
  }

  let resources = fs.readdirSync(resourcesPath);
  const promises: Promise<any>[] = [];

  for (const resource of resources) {
    const resourcePath = path.join(resourcesPath, resource);

    const promise = fs.promises.readFile(resourcePath).then(content => {
      const extension = resource.split(".").pop();
      const key = resource.replace(`.${extension}`, "");
      contents[key] = content.toString();
    });
    promises.push(promise);
  }

  await Promise.all(promises);
  return {_id: id, contents};
}

describe("Representative", () => {
  let cwd: string;
  let representative: VCRepresentativeManager;
  let id: string;

  beforeEach(() => {
    id = new ObjectId().toString();
    cwd = path.join(os.tmpdir(), uuidv4(), "representatives");
    representative = new VCRepresentativeManager(cwd);
  });

  afterEach(async () => {
    await representative.rm();
  });

  describe("write", () => {
    it("should write yaml", async () => {
      const stringified = YAML.stringify({write_me: "ok"});
      await representative.write("module1", id, "schema", stringified, "yaml");

      const directory = path.join(cwd, "module1", id);
      expect(fs.existsSync(directory)).toEqual(true);

      const fileNames = fs.readdirSync(directory);
      expect(fileNames).toEqual(["schema.yaml"]);

      const filePath = path.join(directory, "schema.yaml");
      const fileContent = fs.readFileSync(filePath);

      expect(fileContent.toString()).toEqual("write_me: ok\n");
    });

    it("should write js file", async () => {
      await representative.write("module2", id, "index", "console.log()", "js");

      const fileContent = fs.readFileSync(path.join(cwd, "module2", id, "index.js"));

      expect(fileContent.toString()).toEqual("console.log()");
    });

    it("should write json file", async () => {
      const stringified = JSON.stringify({imjson: "ok"});
      await representative.write("module3", id, "index", stringified, "json");

      const fileContent = fs.readFileSync(path.join(cwd, "module3", id, "index.json"));

      expect(fileContent.toString()).toEqual('{"imjson":"ok"}');
    });
  });

  describe("read", () => {
    it("should read content of files", async () => {
      const stringifiedJSON = JSON.stringify({dependencies: {dep1: "1.1"}});
      await representative.write("module4", id, "package", stringifiedJSON, "json");
      const stringifiedYAML = YAML.stringify({title: "hi"});
      await representative.write("module4", id, "schema", stringifiedYAML, "yaml");
      await representative.write("module4", id, "index", "console.log(123)", "js");
      await sleep();

      const resource = await readResource(representative, "module4", id);
      const parsed = {
        ...resource,
        contents: {
          ...resource.contents,
          package: JSON.parse(resource.contents.package),
          schema: YAML.parse(resource.contents.schema)
        }
      };
      expect(parsed).toEqual({
        _id: id,
        contents: {
          package: {dependencies: {dep1: "1.1"}},
          schema: {title: "hi"},
          index: "console.log(123)"
        }
      });
    });
  });

  describe("watch", () => {
    it("should track insert change type", done => {
      representative.watch("module5", ["schema.yaml"]).subscribe({
        next: change => {
          const parsedContent = YAML.parse(change.resource.content);
          change.resource = {...change.resource, content: parsedContent};

          expect(change).toEqual({
            resourceType: ResourceType.REPRESENTATIVE,
            changeType: ChangeTypes.INSERT,
            resource: {_id: id, content: {title: "hi"}}
          });
          done();
        }
      });

      const stringified = YAML.stringify({title: "hi"});
      representative.write("module5", id, "schema", stringified, "yaml");
    });

    it("should track update change type", done => {
      representative.watch("module6", ["schema.yaml"]).subscribe({
        next: change => {
          if (change.changeType !== ChangeTypes.UPDATE) return;

          const parsedContent = YAML.parse(change.resource.content);
          change.resource = {...change.resource, content: parsedContent};

          expect(change).toEqual({
            resourceType: ResourceType.REPRESENTATIVE,
            changeType: ChangeTypes.UPDATE,
            resource: {_id: id, content: {title: "hello"}}
          });
          done();
        }
      });

      setTimeout(() => {
        const stringified = YAML.stringify({title: "hi"});
        representative.write("module6", id, "schema", stringified, "yaml");
      }, 1000);

      setTimeout(() => {
        const updated = YAML.stringify({title: "hello"});
        representative.write("module6", id, "schema", updated, "yaml");
      }, 2000);
    });

    it("should track delete change type", done => {
      representative.watch("module7", ["schema.yaml"]).subscribe({
        next: change => {
          if (change.changeType !== ChangeTypes.DELETE) return;

          expect(change).toEqual({
            resourceType: ResourceType.REPRESENTATIVE,
            changeType: ChangeTypes.DELETE,
            resource: {_id: id, content: ""}
          });
          done();
        }
      });

      setTimeout(() => {
        const stringified = YAML.stringify({title: "hi"});
        representative.write("module7", id, "schema", stringified, "yaml");
      }, 1000);

      setTimeout(() => {
        representative.rm("module7", id);
      }, 2000);
    });
  });
});
