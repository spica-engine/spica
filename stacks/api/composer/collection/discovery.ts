import * as glob from "fast-glob";
import {readFile} from "fs";
import * as path from "path";
import {Collection, ELEMENT_SCHEMA_URL, SERVICE_SCHEMA_URL} from "./interface";

export class CollectionDiscovery {
  constructor(public root: string) {}

  collect(): Promise<Collection[]> {
    const collections = [];
    const startTime = Date.now();
    return glob(["*/*/package.json", "*/package.json", "!node_modules"], {
      cwd: path.join(this.root, "node_modules"),
      deep: 2
    })
      .then(allPackages =>
        allPackages.map(
          packagePath =>
            new Promise(resolve =>
              readFile(
                path.resolve(this.root, "node_modules", packagePath.toString()),
                (err, data) => {
                  try {
                    const packagee = JSON.parse(data.toString());
                    if (packagee.collection) {
                      collections.push({
                        name: packagee.name,
                        version: packagee.version
                      });
                    }
                    resolve();
                  } catch (e) {
                    resolve();
                  }
                }
              )
            )
        )
      )
      .then(promises => Promise.all(promises))
      .then(() => {
        console.log(`Collection collecting took ${(Date.now() - startTime) / 1000}s.`);
        return collections;
      });
  }

  discover(collections: Collection[]): Promise<Collection[]> {
    const startTime = Date.now();
    return Promise.all(
      collections.map(collection => {
        return glob("**/(element|service).schema.json", {
          cwd: path.join(this.root, "node_modules", collection.name)
        }).then(schemas =>
          Promise.all(
            schemas.map(
              schemaPath =>
                new Promise(resolve =>
                  readFile(
                    path.resolve(this.root, "node_modules", collection.name, schemaPath.toString()),
                    (err, data) => {
                      try {
                        const schema = JSON.parse(data.toString());
                        if (schema.$schema == SERVICE_SCHEMA_URL) {
                          collection.services = collection.services || [];
                          collection.services.push(schema);
                        } else if (schema.$schema == ELEMENT_SCHEMA_URL) {
                          collection.elements = collection.elements || [];
                          collection.elements.push(schema);
                        }
                        resolve();
                      } catch (e) {
                        console.log(e);
                        resolve();
                      }
                    }
                  )
                )
            )
          ).then(() => collection)
        );
      })
    ).then(() => {
      console.log(`Collecting collection schemas took ${(Date.now() - startTime) / 1000}s.`);
      return collections;
    });
  }
}
