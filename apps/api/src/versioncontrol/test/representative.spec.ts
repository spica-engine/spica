// TODO: Rewrite here

// import {ObjectId} from "@spica-devkit/database";
// import {ChangeType} from "@spica-server/interface/versioncontrol";
// import {VCRepresentativeManager} from "@spica-server/representative";
// import fs from "fs";
// import path from "path";
// import YAML from "yaml";
// import {v4 as uuidv4} from "uuid";
// import os from "os";

// const sleep = () => new Promise(r => setTimeout(r, 5000));

// async function readResource(
//   representative: VCRepresentativeManager,
//   module: string,
//   id: string
// ): Promise<any> {
//   const moduleDir = representative.getModuleDir(module);
//   const resourcesPath = path.join(moduleDir, id);
//   const contents = {};

//   if (!fs.existsSync(resourcesPath)) {
//     return Promise.resolve(contents);
//   }

//   let resources = fs.readdirSync(resourcesPath);
//   const promises: Promise<any>[] = [];

//   for (const resource of resources) {
//     const resourcePath = path.join(resourcesPath, resource);

//     const promise = fs.promises.readFile(resourcePath).then(content => {
//       const extension = resource.split(".").pop();
//       const key = resource.replace(`.${extension}`, "");
//       contents[key] = content.toString();
//     });
//     promises.push(promise);
//   }

//   await Promise.all(promises);
//   return {_id: id, contents};
// }

// describe("Representative", () => {
//   let cwd: string;
//   let representative: VCRepresentativeManager;
//   let id: string;

//   beforeEach(() => {
//     id = new ObjectId().toString();
//     cwd = path.join(os.tmpdir(), uuidv4(), "representatives");
//     representative = new VCRepresentativeManager(cwd);
//   });

//   afterEach(async () => {
//     await representative.rm();
//   });

//   describe("write", () => {
//     it("should write yaml", async () => {
//       const stringified = YAML.stringify({write_me: "ok"});
//       await representative.write("module1", "module1", "schema", stringified, "yaml");

//       const directory = path.join(cwd, "module1", "module1");
//       expect(fs.existsSync(directory)).toEqual(true);

//       const fileNames = fs.readdirSync(directory);
//       expect(fileNames).toEqual(["schema.yaml"]);

//       const filePath = path.join(directory, "schema.yaml");
//       const fileContent = fs.readFileSync(filePath);

//       expect(fileContent.toString()).toEqual("write_me: ok\n");
//     });

//     it("should write js file", async () => {
//       await representative.write("module2", "module2", "index", "console.log()", "js");

//       const fileContent = fs.readFileSync(path.join(cwd, "module2", "module2", "index.js"));

//       expect(fileContent.toString()).toEqual("console.log()");
//     });

//     it("should write json file", async () => {
//       const stringified = JSON.stringify({imjson: "ok"});
//       await representative.write("module3", "module3", "index", stringified, "json");

//       const fileContent = fs.readFileSync(path.join(cwd, "module3", "module3", "index.json"));

//       expect(fileContent.toString()).toEqual('{"imjson":"ok"}');
//     });
//   });

//   describe("read", () => {
//     it("should read content of files", async () => {
//       const stringifiedJSON = JSON.stringify({dependencies: {dep1: "1.1"}});
//       await representative.write("module4", "module4", "package", stringifiedJSON, "json");
//       const stringifiedYAML = YAML.stringify({title: "hi"});
//       await representative.write("module4", "module4", "schema", stringifiedYAML, "yaml");
//       await representative.write("module4", "module4", "index", "console.log(123)", "js");
//       await sleep();

//       const resource = await readResource(representative, "module4", "module4");
//       const parsed = {
//         ...resource,
//         contents: {
//           ...resource.contents,
//           package: JSON.parse(resource.contents.package),
//           schema: YAML.parse(resource.contents.schema)
//         }
//       };
//       expect(parsed).toEqual({
//         _id: "module4",
//         contents: {
//           package: {dependencies: {dep1: "1.1"}},
//           schema: {title: "hi"},
//           index: "console.log(123)"
//         }
//       });
//     });
//   });

//   describe("watch", () => {
//     it("should track insert change type", done => {
//       representative.watch("module5", ["schema.yaml"]).subscribe({
//         next: change => {
//           if (change.changeType !== ChangeType.CREATE) return;

//           const parsedContent = YAML.parse(change.resource.content);
//           change.resource = {...change.resource, content: parsedContent};

//           expect(change).toEqual({
//             resourceType: ResourceType.REPRESENTATIVE,
//             changeType: ChangeTypes.INSERT,
//             resource: {slug: "module5", content: {title: "hi"}}
//           });
//           done();
//         }
//       });

//       setTimeout(async () => {
//         const stringified = YAML.stringify({title: "hi"});
//         await representative.write("module5", "module5", "schema", stringified, "yaml");
//       }, 1000);
//     });

//     it("should track update change type", done => {
//       representative.watch("module6", ["schema.yaml"]).subscribe({
//         next: change => {
//           if (change.changeType !== ChangeTypes.UPDATE) return;

//           const parsedContent = YAML.parse(change.resource.content);
//           change.resource = {...change.resource, content: parsedContent};

//           expect(change).toEqual({
//             resourceType: ResourceType.REPRESENTATIVE,
//             changeType: ChangeTypes.UPDATE,
//             resource: {slug: "module6", content: {title: "hello"}}
//           });
//           done();
//         }
//       });

//       setTimeout(async () => {
//         const stringified = YAML.stringify({title: "hi"});
//         await representative.write("module6", "module6", "schema", stringified, "yaml");
//       }, 1000);

//       setTimeout(async () => {
//         const updated = YAML.stringify({title: "hello"});
//         await representative.write("module6", "module6", "schema", updated, "yaml");
//       }, 2000);
//     });

//     it("should track delete change type", done => {
//       representative.watch("module7", ["schema.yaml"]).subscribe({
//         next: change => {
//           if (change.changeType !== ChangeTypes.DELETE) return;

//           expect(change).toEqual({
//             resourceType: ResourceType.REPRESENTATIVE,
//             changeType: ChangeTypes.DELETE,
//             resource: {slug: "module7", content: ""}
//           });
//           done();
//         }
//       });

//       setTimeout(async () => {
//         const stringified = YAML.stringify({title: "hi"});
//         await representative.write("module7", "module7", "schema", stringified, "yaml");
//       }, 1000);

//       setTimeout(async () => {
//         await representative.rm("module7", "module7");
//       }, 2000);
//     });
//   });
// });
