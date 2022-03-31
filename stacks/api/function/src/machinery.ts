import {ObjectId} from "@spica-server/database";
import {
  DocumentProvider,
  register,
  RepresentativeManager,
  RepresentativeProvider,
  store
} from "@spica-server/machinery";
import {ChangeKind, createTargetChanges} from "./change";
import {FunctionEngine} from "./engine";
import {FunctionService, Function, Trigger} from "@spica-server/function/services";

export const returnSyncProviders = (
  service: FunctionService,
  representative: RepresentativeManager,
  engine: FunctionEngine
) => {
  const module = "function";
  const resourceNameValidator = str => ObjectId.isValid(str);

  const gainObjectId = doc => {
    if (doc._id && typeof doc._id == "string") {
      doc._id = new ObjectId(doc._id);
    }
    return doc;
  };
  const loseObjectId = doc => {
    if (doc._id && typeof doc._id != "string") {
      doc._id = doc._id.toString();
    }
    return doc;
  };

  const docProvider: DocumentProvider = {
    module,
    insert: doc => service.insertOne(gainObjectId(doc)),

    update: doc => {
      doc = gainObjectId(doc);
      const copy = JSON.parse(JSON.stringify(doc));
      delete copy._id;
      return service.findOneAndReplace({_id: doc._id}, copy);
    },

    delete: id => service.findOneAndDelete({_id: new ObjectId(id)}).then(() => {}),

    getAll: () => service.find().then(docs => docs.map(doc => loseObjectId(doc)))
  };

  const repProvider: RepresentativeProvider = {
    module,

    insert: doc => {
      doc = loseObjectId(doc);
      return representative.write(module, doc._id, "schema", doc, "yaml");
    },

    update: doc => {
      doc = loseObjectId(doc);
      return representative.write(module, doc._id, "schema", doc, "yaml");
    },

    delete: doc => representative.delete(module, doc._id),
    getAll: () =>
      representative
        .readAll(module, resourceNameValidator)
        .then(resources => resources.map(resource => resource.contents.schema))
  };

  // FUNCTION INDEX
  const docProviderIndex: DocumentProvider = {
    module: "function-index",
    insert: async doc => {
      const fn = await service.findOne({_id: doc._id});

      await engine.update(fn, doc.index);

      const changes = createTargetChanges(fn, ChangeKind.Updated);
      engine.categorizeChanges(changes);

      return engine.compile(fn);
    },

    update: async doc => {
      const fn = await service.findOne({_id: doc._id});

      await engine.update(fn, doc.index);

      const changes = createTargetChanges(fn, ChangeKind.Updated);
      engine.categorizeChanges(changes);

      return engine.compile(fn);
    },

    // index delete is not possible because it can break the function
    delete: () => Promise.resolve(),

    getAll: async () => {
      const fns = await service.find();
      const promises = [];

      const results = [];
      for (const fn of fns) {
        promises.push(
          engine.read(fn).then(index => {
            results.push({_id: fn._id.toString(), index});
          })
        );
      }

      return Promise.all(promises).then(() => results);
    }
  };

  const repProviderIndex: RepresentativeProvider = {
    module: "function-index",

    insert: doc => {
      doc = loseObjectId(doc);
      return representative.write(module, doc._id, "index", doc.index, "js");
    },

    update: doc => {
      doc = loseObjectId(doc);
      return representative.write(module, doc._id, "index", doc.index, "js");
    },

    // index delete is not possible because it can break the function
    delete: doc => representative.delete(module, doc._id),
    getAll: () =>
      representative.readAll(module, resourceNameValidator).then(resources =>
        resources.map(resource => {
          return {_id: resource.id, index: resource.contents.index};
        })
      )
  };

  // FUNCTION DEPENDENCIES
  const docProviderDeps: DocumentProvider = {
    module: "function-dependency",

    insert: async doc => {
      const fn = await service.findOne({_id: doc._id});
      return engine.addPackage(fn, doc.dependencies).toPromise();
    },

    update: async doc => {
      const fn = await service.findOne({_id: doc._id});

      // uninstall all packages
      await engine.getPackages(fn).then(packages => {
        return packages.map(pkg => engine.removePackage(fn, pkg.name));
      });

      // install the new ones
      return engine.addPackage(fn, doc.dependencies).toPromise();
    },

    // package.json delete is not possible because it can break the function
    delete: () => Promise.resolve(),

    getAll: async () => {
      const fns = await service.find();
      const promises = [];

      const results = [];
      for (const fn of fns) {
        promises.push(
          engine.getPackages(fn).then(deps => {
            deps = deps.map(dep => {
              delete dep.types;
              return dep;
            });
            results.push({_id: fn._id.toString(), package: {dependencies: deps}});
          })
        );
      }

      return Promise.all(promises).then(() => results);
    }
  };

  const repProviderDeps: RepresentativeProvider = {
    module: "function-dependency",

    insert: doc => {
      doc = loseObjectId(doc);
      return representative.write(
        module,
        doc._id,
        "package",
        {dependencies: doc.package.dependencies},
        "json"
      );
    },

    update: doc => {
      doc = loseObjectId(doc);
      return representative.write(module, doc._id, "package", {dependencies: doc.package.dependencies}, "json");
    },

    delete: () => Promise.resolve(),
    getAll: () =>
      representative.readAll(module, resourceNameValidator).then(resources =>
        resources.map(resource => {
          return {_id: resource.id, package: resource.contents.package};
        })
      )
  };

  return {
    docs: [docProvider, docProviderIndex, docProviderDeps],
    reps: [repProvider, repProviderIndex, repProviderDeps]
  };
};

async function v1_trigger_to_internal(object: any) {
  const bucketStore = store({
    group: "bucket",
    resource: "schemas"
  });

  const triggerRaw: Trigger = {
    active: true,
    type: object.spec.type,
    options: {}
  };

  switch (object.spec.type) {
    case "http":
      triggerRaw.options = object.spec.httpOptions;
      break;

    case "bucket":
      const bkt = object.spec.bucketOptions.bucket;

      const bucket = await bucketStore.get(bkt.resourceFieldRef.schemaName);

      triggerRaw.options = {
        type: object.spec.bucketOptions.type
      };

      // TODO: think about a better way to handle this
      if (!bucket) {
        triggerRaw.active = false;
      } else {
        triggerRaw.options["bucket"] = bucket.metadata.uid;
      }

      break;

    case "firehose":
      triggerRaw.options = object.spec.firehoseOptions;
      break;

    case "schedule":
      triggerRaw.options = {
        frequency: object.spec.scheduleOptions.frequency,
        timezone: object.spec.scheduleOptions.timezone
      };
      break;

    case "system":
      triggerRaw.options = object.spec.systemOptions;
      break;

    case "database":
      const options = object.spec.databaseOptions;

      triggerRaw.options = {
        type: options.type
      };

      if (typeof options.collection == "string") {
        triggerRaw.options["collection"] = options.collection;
      } else if (typeof options.collection == "object") {
        const bucket = await bucketStore.get(options.collection.resourceFieldRef.schemaName);

        if (!bucket) {
          triggerRaw.active = false;
        } else {
          triggerRaw.options["collection"] = `bucket_${bucket.metadata.uid}`;
        }
      }

      break;
  }

  return triggerRaw;
}

async function v1_function_to_internal(object: any) {
  const {spec} = object;
  return <Function>{
    name: spec.title,
    description: spec.description,
    language: spec.runtime.language.toLowerCase(),
    timeout: spec.timeout,
    triggers: {},
    env: await v1_function_env_to_internal(spec.environment)
  };
}

async function v1_function_env_to_internal(environment: any[]) {
  const bucketStore = store({
    group: "bucket",
    resource: "schemas"
  });

  const apiKeyStore = store<any>({
    group: "passport",
    resource: "apikeys"
  });

  const env = {};

  for (const {name, value, valueFrom} of environment) {
    if (typeof value == "string") {
      env[name] = String(value);
    } else if (typeof valueFrom == "object") {
      const ref = valueFrom.resourceFieldRef;
      let value: string;

      if (ref.schemaName) {
        const bucket = await bucketStore.get(ref.schemaName);
        if (bucket) {
          value = String(bucket.metadata.uid);
        } else {
          value = `missing schema ${ref.schemaName}`;
        }
      } else if (ref.apiKeyName) {
        const apiKey = await apiKeyStore.get(ref.apiKeyName);
        if (apiKey) {
          value = String(apiKey.spec.key);
        } else {
          value = `missing apikey ${ref.schemaName}`;
        }
      }

      env[name] = value;
    }
  }

  return env;
}

async function applyDependencyChanges(
  before: any[],
  after: any[],
  fe: FunctionEngine,
  fn: Function
) {
  const newPackages = [];
  const removedPackages = [];

  const newPackageMap = new Map<string, string>();

  for (const dependency of after) {
    newPackageMap.set(dependency.name, dependency.version);
  }

  const oldPackageMap = new Map<string, string>();

  for (const dependency of before) {
    oldPackageMap.set(dependency.name, dependency.version);
  }

  for (const [name, version] of newPackageMap.entries()) {
    if (!oldPackageMap.has(name) || oldPackageMap.get(name) != version) {
      newPackages.push(`${name}@${version}`);
    }
  }

  for (const name of oldPackageMap.keys()) {
    if (!newPackageMap.has(name)) {
      removedPackages.push(name);
    }
  }

  for (const removePackage of removedPackages) {
    await fe.removePackage(fn, removePackage);
  }

  await fe.addPackage(fn, newPackages).toPromise();
}

export function registerInformers(fs: FunctionService, fe: FunctionEngine) {
  const getStore = (resource: string) =>
    store<any>({
      group: "function",
      resource: resource
    });

  register(
    {
      group: "function",
      resource: "triggers",
      version: "v1"
    },
    {
      add: async (object: any) => {
        const fn = await getStore("functions").get(object.spec.func);
        if (fn) {
          const trigger = await v1_trigger_to_internal(object);
          await fs.updateOne(
            {_id: new ObjectId(fn.metadata.uid)},
            {$set: {[`triggers.${object.spec.name}`]: trigger}}
          );

          fe.categorizeChanges([
            {
              kind: ChangeKind.Added,
              target: {
                id: fn.metadata.uid,
                handler: object.spec.name,
                context: {
                  timeout: fn.spec.timeout,
                  env: await v1_function_env_to_internal(fn.spec.environment)
                }
              },
              type: trigger.type,
              options: trigger.options
            }
          ]);
        } else {
          await getStore("triggers").patch(object.metadata.name, {status: "ErrFuncNotFound"});
        }
      },
      update: async (_, object: any) => {
        const fn = await getStore("functions").get(object.spec.func);
        if (fn) {
          const trigger = await v1_trigger_to_internal(object);
          await fs.updateOne(
            {_id: new ObjectId(fn.metadata.uid)},
            {$set: {[`triggers.${object.spec.name}`]: trigger}}
          );
          fe.categorizeChanges([
            {
              kind: ChangeKind.Updated,
              target: {
                id: fn.metadata.uid,
                handler: object.spec.name,
                context: {
                  timeout: fn.spec.timeout,
                  env: await v1_function_env_to_internal(fn.spec.environment)
                }
              },
              type: trigger.type,
              options: trigger.options
            }
          ]);
        } else {
          await getStore("triggers").patch(object.metadata.name, {status: "ErrFuncNotFound"});
        }
      },
      delete: async object => {
        const fn = await getStore("functions").get(object.spec.func);
        if (fn) {
          await fs.updateOne(
            {_id: new ObjectId(fn.metadata.uid)},
            {$unset: {[`triggers.${object.spec.name}`]: ""}}
          );
          fe.categorizeChanges([
            {
              kind: ChangeKind.Removed,
              target: {
                id: fn.metadata.uid,
                handler: object.spec.name
              }
            }
          ]);
        } else {
          await getStore("triggers").patch(object.metadata.name, {status: "ErrFuncNotFound"});
        }
      }
    }
  );

  register(
    {
      group: "function",
      resource: "functions",
      version: "v1"
    },
    {
      add: async (obj: any) => {
        await getStore("functions").patch(obj.metadata.name, {status: "Pending"});
        let fn;
        try {
          const raw = await v1_function_to_internal(obj);
          fn = await fs.insertOne(raw);
          await getStore("functions").patch(obj.metadata.name, {
            metadata: {uid: String(fn._id)},
            status: "Creating"
          });

          await fe.createFunction(fn);
          await fe.update(fn, obj.spec.code);
          await fe.compile(fn);

          await applyDependencyChanges([], obj.spec.dependency, fe, fn);
        } catch (e) {
          if (fn) {
            await fs.deleteOne({_id: fn._id});
          }

          throw e;
        }

        await getStore("functions").patch(obj.metadata.name, {status: "Ready"});
      },
      update: async (oldObj, obj: any) => {
        const raw = await v1_function_to_internal(obj);
        delete raw.triggers;
        const fn = await fs.findOneAndUpdate(
          {_id: new ObjectId(obj.metadata.uid)},
          {$set: raw},
          {returnOriginal: false, upsert: true}
        );
        if (oldObj.spec.code != obj.spec.code) {
          await fe.update(fn, obj.spec.code);
          await fe.compile(fn);
        }
        await applyDependencyChanges(oldObj.spec.dependency, obj.spec.dependency, fe, fn);
      },
      delete: async (obj: any) => {
        const id = new ObjectId(obj.metadata.uid);
        const fn = await fs.findOneAndDelete({_id: id});
        fe.deleteFunction(fn);
        fe.categorizeChanges([
          {
            kind: ChangeKind.Removed,
            target: {
              id: obj.metadata.uid
            }
          }
        ]);
      }
    }
  );
}
