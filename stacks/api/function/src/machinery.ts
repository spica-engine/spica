import {ObjectId} from "@spica-server/database";
import {register, store} from "@spica-server/machinery";
import {ChangeKind} from "./change";
import {FunctionEngine} from "./engine";
import {FunctionService} from "./function.service";
import {Function} from "./interface";

async function v1_trigger_to_internal(object: any) {
  const bucketStore = store({
    group: "bucket",
    resource: "schemas"
  });

  const triggerRaw = {
    active: true,
    type: object.spec.type,
    options: {}
  };

  if (object.spec.type == "http") {
    triggerRaw.options = object.spec.httpOptions;
  } else if (object.spec.type == "bucket") {
    const bkt = object.spec.bucketOptions.bucket;

    const bucket = await bucketStore.get(bkt.resourceFieldRef.schemaName);

    triggerRaw.options = {
      type: object.spec.bucketOptions.type,
      phase: object.spec.bucketOptions.phase.toUpperCase()
    };

    // TODO: think about a better way to handle this
    if (!bucket) {
      triggerRaw.active = false;
    } else {
      triggerRaw.options["bucket"] = bucket.metadata.uid;
    }
  } else if (object.spec.type == "firehose") {
    triggerRaw.options = object.spec.firehoseOptions;
  } else if (object.spec.type == "schedule") {
    triggerRaw.options = {
      frequency: object.spec.scheduleOptions.cronSpec,
      timezone: object.spec.scheduleOptions.timezone
    };
  } else if (object.spec.type == "system") {
    triggerRaw.options = object.spec.systemOptions;
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
  const functionStore = store<any>({
    group: "function",
    resource: "functions"
  });
  const triggerStore = store<any>({
    group: "function",
    resource: "triggers"
  });

  register(
    {
      group: "function",
      resource: "triggers",
      version: "v1"
    },
    {
      add: async (object: any) => {
        const fn = await functionStore.get(object.spec.func);
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
          await triggerStore.patch(object.metadata.name, {status: "ErrFuncNotFound"});
        }
      },
      update: async (_, object: any) => {
        const fn = await functionStore.get(object.spec.func);
        if (fn) {
          const trigger = await v1_trigger_to_internal(object);
          console.log(trigger);
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
          await triggerStore.patch(object.metadata.name, {status: "ErrFuncNotFound"});
        }
      },
      delete: async object => {
        const fn = await functionStore.get(object.spec.func);
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
          await triggerStore.patch(object.metadata.name, {status: "ErrFuncNotFound"});
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
        await functionStore.patch(obj.metadata.name, {status: "Pending"});
        let fn;
        try {
          const raw = await v1_function_to_internal(obj);
          fn = await fs.insertOne(raw);
          await functionStore.patch(obj.metadata.name, {
            metadata: {uid: String(fn._id)},
            status: "Creating"
          });

          await fe.createFunction(fn);
          await fe.update(fn, obj.spec.code);
          await fe.compile(fn);

          await applyDependencyChanges([], obj.spec.dependency, fe, fn);
        } catch (e) {
          if ( fn ) {
            await fs.deleteOne({_id: fn._id});
          }

          throw e;
        }

        await functionStore.patch(obj.metadata.name, {status: "Ready"});
      },
      update: async (oldObj, obj: any) => {
        const raw = await v1_function_to_internal(obj);
        delete raw.triggers;
        const fn = await fs.findOneAndUpdate(
          {_id: new ObjectId(obj.metadata.uid)},
          {$set: raw},
          {returnOriginal: false}
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
