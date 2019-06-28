import * as pacote from "pacote";
import {CollectionDiscovery} from "./discovery";
import {
  Collection,
  CollectionManifest,
  ElementFlags,
  ElementSchema,
  ServiceSchema
} from "./interface";
import * as child_process from "child_process";

export class CollectionRegistry {
  private collectionCache: Collection[];

  //@ts-ignore
  private builtInElements(): Array<ElementSchema> {
    return [
      {
        $id: "http://schemas.spicacms.io/composer/elements/h1",
        $schema: "http://schemas.spicacms.io/composer/element",
        type: "object",
        icon: "text_fields",
        title: "Heading 1",
        name: "h1",
        slot: "text",
        flags: ElementFlags.Slotted
      },
      {
        $id: "http://schemas.spicacms.io/composer/elements/h2",
        $schema: "http://schemas.spicacms.io/composer/element",
        type: "object",
        icon: "text_fields",
        title: "Heading 2",
        name: "h2",
        slot: "text",
        flags: ElementFlags.Slotted
      },
      {
        $id: "http://schemas.spicacms.io/composer/elements/h3",
        $schema: "http://schemas.spicacms.io/composer/element",
        type: "object",
        icon: "text_fields",
        title: "Heading 3",
        name: "h3",
        slot: "text",
        flags: ElementFlags.Slotted
      },
      {
        $id: "http://schemas.spicacms.io/composer/elements/h4",
        $schema: "http://schemas.spicacms.io/composer/element",
        type: "object",
        icon: "text_fields",
        title: "Heading 4",
        name: "h4",
        slot: "text",
        flags: ElementFlags.Slotted
      },
      {
        $id: "http://schemas.spicacms.io/composer/elements/h5",
        $schema: "http://schemas.spicacms.io/composer/element",
        type: "object",
        icon: "text_fields",
        title: "Heading 5",
        name: "h5",
        slot: "text",
        flags: ElementFlags.Slotted
      },
      {
        $id: "http://schemas.spicacms.io/composer/elements/h6",
        $schema: "http://schemas.spicacms.io/composer/element",
        type: "object",
        icon: "text_fields",
        title: "Heading 6",
        name: "h6",
        slot: "text",
        flags: ElementFlags.Slotted
      }
    ];
  }

  constructor(private discovery: CollectionDiscovery) {}

  collections() {
    if (this.collectionCache) {
      return Promise.resolve(this.collectionCache);
    }
    return this.discovery.collect().then(collections => this.discovery.discover(collections));
  }

  fetchCollection(spec: string): Promise<CollectionManifest> {
    return pacote
      .manifest(spec, {"full-metadata": true})
      .catch(() => new Error(`Collection ${spec} can not found.`))
      .then((manifest: CollectionManifest) => {
        if (!manifest.collection) {
          throw new Error(`Package ${spec} is not a collection.`);
        }
        return manifest;
      });
  }

  installCollection(manifest: CollectionManifest) {
    return new Promise((resolve, reject) => {
      const proc = child_process.spawn("npm", ["install", manifest.name], {
        cwd: this.discovery.root
      });
      proc.on("close", code => {
        if (code == 0) {
          return resolve(manifest);
        }
        console.log(`Npm exited with error code ${code}`);
        reject(`Installation failed. Code: ${code}`);
      });
    });
  }

  getElements() {
    return this.collections().then(collections =>
      collections.reduce((schemas, collection) => {
        schemas.push(...(collection.elements || []));
        return schemas;
      }, new Array<ElementSchema>())
    );
  }

  getElement(name: string) {
    return this.getElements().then(elements => elements.find(element => element.name == name));
  }

  getServices() {
    return this.collections().then(collections =>
      collections.reduce((schemas, collection) => {
        schemas.push(...(collection.services || []));
        return schemas;
      }, new Array<ServiceSchema>())
    );
  }

  getService(name: string): Promise<ServiceSchema>;
  getService(importSpecifier: string, moduleSpecifier: string): Promise<ServiceSchema>;
  getService(importSpecifierOrName: string, moduleSpecifier?: string): Promise<ServiceSchema> {
    if (!moduleSpecifier) {
      return this.getServices().then(services =>
        services.find(s => s.name == importSpecifierOrName)
      );
    } else {
      return this.getServices().then(services =>
        services.find(
          s =>
            s.$entrypoint.importSpecifier == importSpecifierOrName &&
            s.$entrypoint.moduleSpecifier == moduleSpecifier
        )
      );
    }
  }
}
