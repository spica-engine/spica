import {ActionParameters, CaporalValidator, Command, CreateCommandParameters} from "@caporal/core";
import {spin} from "../../console";
import {httpService} from "../../http";
import {availableSyncModules, validateSyncModules} from "../../validator";
import {bold, green, red} from "colorette";
import {isEqual} from "lodash";

let IGNORE_ERRORS;
let CONCURRENCY_LIMIT;

async function sync({
  options: {
    sourceUrl,
    sourceApikey,
    targetUrl,
    targetApikey,
    modules,
    dryRun,
    syncFnEnv,
    ignoreErrors,
    concurrencyLimit
  }
}: ActionParameters) {
  IGNORE_ERRORS = ignoreErrors;
  CONCURRENCY_LIMIT = concurrencyLimit as number;

  const sourceService = httpService.create({
    baseUrl: sourceUrl.toString(),
    authorization: `APIKEY ${sourceApikey}`
  });

  const targetService = httpService.create({
    baseUrl: targetUrl.toString(),
    authorization: `APIKEY ${targetApikey}`
  });

  modules = modules
    .toString()
    .split(",")
    .map(m => m.trim());

  // add new core synchronizer here
  const coreSynchronizers = [FunctionSynchronizer, BucketSynchronizer];
  const synchronizers = [];

  for (const Ctor of coreSynchronizers) {
    const synchronizer = new Ctor(sourceService, targetService, {syncFnEnv});
    const subSynchronizers = await synchronizer.initialize().catch(e => {
      return Promise.reject(returnErrorMessage(e));
    });

    synchronizers.push(synchronizer);
    synchronizers.push(...subSynchronizers);
  }

  for (const name of modules) {
    const moduleSynchronizers = synchronizers.filter(s => s.moduleName == name);

    if (!moduleSynchronizers.length) {
      return Promise.reject(`Module ${name} does not exist.`);
    }

    for (const synchronizer of moduleSynchronizers) {
      const {insertions, updations, deletions} = await synchronizer.analyze().catch(e => {
        return Promise.reject(returnErrorMessage(e));
      });
      if (dryRun) {
        printActions({
          insertions,
          updations,
          deletions,
          field: synchronizer.primaryField,
          moduleName: synchronizer.getDisplayableModuleName()
        });
      } else {
        await synchronizer.synchronize().catch(e => Promise.reject(returnErrorMessage(e)));
        console.log(
          `\n${synchronizer.getDisplayableModuleName()} synchronization has been completed!`.toUpperCase()
        );
      }
    }
  }
}

export default function({createCommand}: CreateCommandParameters): Command {
  return createCommand(
    `Synchronize selected module objects between two spica instances(local or remote).
${red(
  "ATTENTION"
)}: Source and target instance versions must be minimum v0.9.19 and for the best results both instance versions should be the same. 
Also this command will perform adding, overwriting and removing actions of the target instance and it's irreversible. 
We highly recommend you to use --dry-run=true and check the changes that will be applied before start.`
  )
    .option("--source-url", "API address of the instance where objects will be synchronized from", {
      required: true,
      validator: CaporalValidator.STRING
    })
    .option("--source-apikey", "Apikey of the instance where objects will be synchronized from", {
      required: true,
      validator: CaporalValidator.STRING
    })
    .option("--target-url", "API address of the instance where objects will be synchronized to", {
      required: true,
      validator: CaporalValidator.STRING
    })
    .option(
      "--target-apikey",
      "API address of the instance where objects will be synchronized to",
      {
        required: true,
        validator: CaporalValidator.STRING
      }
    )
    .option(
      "--modules",
      `Module names of objects that will be synchronized. Available modules: ${green(
        availableSyncModules.join(",")
      )}`,
      {
        required: true,
        validator: validateSyncModules
      }
    )
    .option("--dry-run", "Shows the changes that will be applied to the target instance.", {
      default: false
    })
    .option(
      "--sync-fn-env",
      "Set true if you need to sync function environment variables as well.",
      {
        default: false
      }
    )
    .option(
      "--ignore-errors",
      "Set true if you don't want to interrupt sync process because of failed requests.",
      {
        default: false
      }
    )
    .option(
      "--concurrency-limit",
      "Increase(if you want to speed up), decrease(if you get some error like ECONNRESET) this value to adjust how many parallel requests that will be sent to the target instance",
      {
        default: 100 as number,
        validator: CaporalValidator.NUMBER
      }
    )
    .action(sync);
}

// @TODO: use it from packages/core/differ
export class ResourceGroupComparisor {
  private existings = [];
  private existingIds = [];

  constructor(
    private sources: any[],
    private targets: any[],
    private uniqueField = "_id",
    private ignoredFields = []
  ) {
    this.existings = targets.filter(target =>
      sources.some(source => source[this.uniqueField] == target[this.uniqueField])
    );

    this.existingIds = this.existings.map(existing => existing[this.uniqueField]);
  }

  updations() {
    const updations = [];
    for (const existing of this.existings) {
      const source = this.sources.find(
        source => source[this.uniqueField] == existing[this.uniqueField]
      );

      if (this.ignoredFields.length) {
        this.ignoredFields.forEach(field => {
          delete source[field];
          delete existing[field];
        });
      }

      if (!isEqual(source, existing)) {
        updations.push(source);
      }
    }

    return updations;
  }

  insertions() {
    return this.sources.filter(source => this.existingIds.indexOf(source[this.uniqueField]) == -1);
  }

  deletions() {
    return this.targets.filter(target => this.existingIds.indexOf(target[this.uniqueField]) == -1);
  }
}
interface ModuleSynchronizer {
  moduleName: string;
  subModuleName?: string;
  primaryField: string;

  insertions: any[];
  updations: any[];
  deletions: any[];

  initialize(): Promise<ModuleSynchronizer[]>;

  analyze(): Promise<{insertions: any[]; updations: any[]; deletions: any[]}>;
  synchronize(): Promise<any>;

  getDisplayableModuleName(): string;
}

export class FunctionSynchronizer implements ModuleSynchronizer {
  moduleName = "function";
  primaryField = "name";

  insertions = [];
  updations = [];
  deletions = [];

  constructor(
    private sourceService: httpService.Client,
    private targetService: httpService.Client,
    private options: {syncFnEnv}
  ) {}

  async initialize() {
    const synchronizers = [];

    const sourceFns = await this.sourceService.get<any[]>("function");

    // put dependency synchronizer for each function
    for (const fn of sourceFns) {
      synchronizers.push(
        new FunctionDependencySynchronizer(this.sourceService, this.targetService, fn)
      );
    }

    synchronizers.push(new FunctionIndexSynchronizer(this.sourceService, this.targetService));

    return synchronizers;
  }

  async analyze() {
    console.log();
    let sourceFns = await spin<any>({
      text: "Fetching functions from source instance",
      op: () => this.sourceService.get("function")
    });

    const targetFns = await spin<any>({
      text: "Fetching functions from target instance",
      op: () => this.targetService.get<any[]>("function")
    });

    if (!this.options.syncFnEnv) {
      sourceFns = sourceFns.map(fn => {
        fn.env = {};
        return fn;
      });
      for (const target of targetFns) {
        const index = sourceFns.findIndex(srcFn => srcFn._id == target._id);
        if (index != -1) {
          sourceFns[index].env = target.env;
        }
      }
    }

    const decider = new ResourceGroupComparisor(sourceFns, targetFns);

    this.insertions = decider.insertions();
    this.updations = decider.updations();
    this.deletions = decider.deletions();

    return {
      insertions: this.insertions,
      updations: this.updations,
      deletions: this.deletions
    };
  }

  async synchronize() {
    console.log();
    const insertPromiseFactories = this.insertions.map(fn => () =>
      this.targetService.post("function", fn).catch(e =>
        handleRejection({
          action: "insert",
          message: returnErrorMessage(e),
          objectName: this.moduleName + " " + fn.name
        })
      )
    );

    await spinUntilPromiseEnd(insertPromiseFactories, "Inserting functions to the target instance");

    const updatePromiseFactories = this.updations.map(fn => () =>
      this.targetService.put(`function/${fn._id}`, fn).catch(e =>
        handleRejection({
          action: "update",
          message: returnErrorMessage(e),
          objectName: this.moduleName + " " + fn.name
        })
      )
    );
    await spinUntilPromiseEnd(updatePromiseFactories, "Updating target instance functions");

    const deletePromiseFactories = this.deletions.map(fn => () =>
      this.targetService.delete(`function/${fn._id}`).catch(e =>
        handleRejection({
          action: "delete",
          objectName: this.moduleName + " " + fn.name,
          message: returnErrorMessage(e)
        })
      )
    );
    await spinUntilPromiseEnd(deletePromiseFactories, "Deleting target instance functions");
  }

  getDisplayableModuleName() {
    return this.moduleName;
  }
}

export class FunctionDependencySynchronizer implements ModuleSynchronizer {
  moduleName = "function";
  subModuleName = "dependency";
  primaryField = "name";

  insertions = [];
  updations = [];
  deletions = [];

  constructor(
    private sourceService: httpService.Client,
    private targetService: httpService.Client,
    private fn: any
  ) {}

  initialize() {
    return Promise.resolve([]);
  }

  async analyze() {
    const deleteTypes = deps =>
      deps.map(d => {
        delete d.types;
        return d;
      });
    const sourceDeps = await this.sourceService
      .get<any[]>(`function/${this.fn._id}/dependencies`)
      .then(deleteTypes);

    const targetDeps = await this.targetService
      .get<any[]>(`function/${this.fn._id}/dependencies`)
      .then(deleteTypes)
      .catch(e => {
        if (isNotFoundException(e)) {
          return [];
        }
        return Promise.reject(e.data);
      });

    const decider = new ResourceGroupComparisor(sourceDeps, targetDeps, "name");

    this.insertions = decider.insertions();
    this.updations = decider.updations();
    this.deletions = decider.deletions();

    return {
      insertions: this.insertions,
      updations: this.updations,
      deletions: this.deletions
    };
  }

  async synchronize() {
    console.log();

    const promiseFactories: (() => Promise<any>)[] = [];
    const insertBody = [...this.insertions, ...this.updations].reduce(
      (acc, dep) => {
        const depName = `${dep.name}@${dep.version.slice(1)}`;
        acc.name.push(depName);
        return acc;
      },
      {name: []}
    );

    if (insertBody.name.length) {
      promiseFactories.push(() =>
        this.targetService.post(`function/${this.fn._id}/dependencies`, insertBody).catch(e => {
          handleRejection({
            action: "insert",
            message: returnErrorMessage(e),
            objectName: this.getDisplayableModuleName()
          });
        })
      );
    }

    const deletePromiseFactories = this.deletions.map(dep => () =>
      this.targetService.delete(`function/${this.fn._id}/dependencies/${dep.name}`).catch(e =>
        handleRejection({
          action: "update",
          message: returnErrorMessage(e),
          objectName: this.getDisplayableModuleName()
        })
      )
    );

    if (deletePromiseFactories.length) {
      promiseFactories.push(...deletePromiseFactories);
    }

    return spinUntilPromiseEnd(
      promiseFactories,
      `Updating function '${this.fn.name}' dependencies`
    );
  }

  getDisplayableModuleName() {
    return `${this.moduleName} '${this.fn.name}' ${this.subModuleName}`;
  }
}

export class FunctionIndexSynchronizer implements ModuleSynchronizer {
  moduleName = "function";
  subModuleName = "index";
  primaryField = "name";

  insertions = [];
  updations = [];
  deletions = [];

  constructor(
    private sourceService: httpService.Client,
    private targetService: httpService.Client
  ) {}

  initialize() {
    return Promise.resolve([]);
  }

  async analyze() {
    const sourceFns = await this.sourceService.get<any[]>("function");

    const sourceFnIndexes = await Promise.all(
      sourceFns.map(fn =>
        this.sourceService.get<any>(`function/${fn._id}/index`).then(res => {
          return {
            _id: fn._id,
            name: fn.name,
            index: res.index
          };
        })
      )
    );

    const targetFnIndexes = await Promise.all(
      sourceFns.map(fn =>
        this.targetService
          .get<any>(`function/${fn._id}/index`)
          .then(res => {
            return {
              _id: fn._id,
              name: fn.name,
              index: res.index
            };
          })
          .catch(e => {
            if (isNotFoundException(e)) {
              return false;
            }
            return Promise.reject(e.data);
          })
      )
    ).then(indexes => indexes.filter(Boolean));

    const decider = new ResourceGroupComparisor(sourceFnIndexes, targetFnIndexes);

    this.insertions = decider.insertions();
    this.updations = decider.updations();
    this.deletions = decider.deletions();

    return {
      insertions: this.insertions,
      updations: this.updations,
      deletions: this.deletions
    };
  }

  synchronize() {
    // except others, we don't need to remove any function index because they are supposed to be deleted with function module synchronization
    const promiseFactories = [...this.insertions, ...this.updations].map(fn => () =>
      this.targetService.post(`function/${fn._id}/index`, {index: fn.index}).catch(e =>
        handleRejection({
          action: "insert",
          objectName: this.getDisplayableModuleName() + " " + fn.name,
          message: returnErrorMessage(e)
        })
      )
    );

    return spinUntilPromiseEnd(
      promiseFactories,
      "Writing indexes to the target instance functions"
    );
  }

  getDisplayableModuleName() {
    return this.moduleName + " " + this.subModuleName;
  }
}

export class BucketDataSynchronizer implements ModuleSynchronizer {
  moduleName = "bucket-data";
  primaryField;
  insertions = [];
  updations = [];
  deletions = [];

  constructor(
    private sourceService: httpService.Client,
    private targetService: httpService.Client,
    private bucket: any
  ) {
    this.primaryField = this.bucket.primary;
  }

  initialize(): Promise<ModuleSynchronizer[]> {
    return Promise.resolve([]);
  }

  async analyze(): Promise<{insertions: any[]; updations: any[]; deletions: any[]}> {
    const params = {
      localize: false
    };
    const sourceData = await this.sourceService.get<any[]>(`bucket/${this.bucket._id}/data`, {
      params
    });

    const targetData = await this.targetService
      .get<any[]>(`bucket/${this.bucket._id}/data`, {
        params
      })
      .catch(e => {
        if (isNotFoundException(e)) {
          return [];
        }
        return Promise.reject(e.data);
      });

    const decider = new ResourceGroupComparisor(sourceData, targetData);

    this.insertions = decider.insertions();
    this.updations = decider.updations();
    this.deletions = decider.deletions();

    return {
      insertions: this.insertions,
      updations: this.updations,
      deletions: this.deletions
    };
  }

  async synchronize(): Promise<any> {
    console.log();
    const insertPromiseFactories = this.insertions.map(data => () =>
      this.targetService.post(`bucket/${this.bucket._id}/data`, data).catch(e =>
        handleRejection({
          action: "insert",
          objectName: this.getDisplayableModuleName() + " " + data[this.primaryField],
          message: returnErrorMessage(e)
        })
      )
    );
    await spinUntilPromiseEnd(
      insertPromiseFactories,
      `Inserting bucket ${this.bucket.title} data to the target instance`
    );

    const updatePromiseFactories = this.updations.map(data => () =>
      this.targetService.put(`bucket/${this.bucket._id}/data/${data._id}`, data).catch(e =>
        handleRejection({
          action: "update",
          message: returnErrorMessage(e),
          objectName: this.getDisplayableModuleName() + " " + data[this.primaryField]
        })
      )
    );
    await spinUntilPromiseEnd(
      updatePromiseFactories,
      `Updating bucket ${this.bucket.title} data on the target instance`
    );

    const deletePromiseFactories = this.deletions.map(data => () =>
      this.targetService.delete(`bucket/${this.bucket._id}/data/${data._id}`).catch(e =>
        handleRejection({
          action: "delete",
          objectName: this.getDisplayableModuleName() + " " + data[this.primaryField],
          message: returnErrorMessage(e)
        })
      )
    );
    await spinUntilPromiseEnd(
      deletePromiseFactories,
      `Deleting bucket ${this.bucket.title} data from the target instance`
    );
  }
  getDisplayableModuleName(): string {
    return `${this.moduleName} '${this.bucket.title}'`;
  }
}

export class BucketSynchronizer implements ModuleSynchronizer {
  moduleName = "bucket";
  primaryField = "title";

  insertions = [];
  updations = [];
  deletions = [];

  constructor(
    private sourceService: httpService.Client,
    private targetService: httpService.Client
  ) {}

  async initialize() {
    const synchronizers = [];

    const sourceBuckets = await this.sourceService.get<any[]>("bucket");
    for (const bucket of sourceBuckets) {
      synchronizers.push(
        new BucketDataSynchronizer(this.sourceService, this.targetService, bucket)
      );
    }
    return synchronizers;
  }

  async analyze() {
    console.log();
    const sourceBuckets = await spin<any>({
      text: "Fetching buckets from source instance",
      op: () => this.sourceService.get("bucket")
    });

    const targetBuckets = await spin<any>({
      text: "Fetching buckets from target instance",
      op: () => this.targetService.get("bucket")
    });

    const decider = new ResourceGroupComparisor(sourceBuckets, targetBuckets);

    this.insertions = decider.insertions();
    this.updations = decider.updations();
    this.deletions = decider.deletions();

    return {
      insertions: this.insertions,
      updations: this.updations,
      deletions: this.deletions
    };
  }

  async synchronize() {
    console.log();
    const insertPromiseFactories = this.insertions.map(bucket => () =>
      this.targetService.post("bucket", bucket).catch(e =>
        handleRejection({
          action: "insert",
          objectName: this.getDisplayableModuleName() + " " + bucket.title,
          message: returnErrorMessage(e)
        })
      )
    );
    await spinUntilPromiseEnd(insertPromiseFactories, "Inserting buckets to the target instance");

    const updatePromiseFactories = this.updations.map(bucket => () =>
      this.targetService.put(`bucket/${bucket._id}`, bucket).catch(e =>
        handleRejection({
          action: "update",
          objectName: this.getDisplayableModuleName() + " " + bucket.title,
          message: returnErrorMessage(e)
        })
      )
    );
    await spinUntilPromiseEnd(updatePromiseFactories, "Updating buckets on the target instance");

    const deletePromiseFactories = this.deletions.map(bucket => () =>
      this.targetService.delete(`bucket/${bucket._id}`).catch(e =>
        handleRejection({
          action: "delete",
          objectName: bucket.title,
          message: returnErrorMessage(e)
        })
      )
    );
    await spinUntilPromiseEnd(deletePromiseFactories, "Deleting bucket from the target instance");
  }

  getDisplayableModuleName(): string {
    return this.moduleName;
  }
}

function printActions({insertions, updations, deletions, field, moduleName}) {
  const joinActions = (actions: any[]) => {
    const MAX_LINES = 20;
    actions = actions.map(a => `- ${a[field]}`);

    if (actions.length > MAX_LINES) {
      actions = actions.slice(0, MAX_LINES);
      actions.push("...more");
    }

    return actions.join("\n");
  };

  console.log();
  console.log(`----- ${moduleName.toUpperCase()} -----`);
  console.log(
    `\n* Found ${bold(insertions.length)} objects to ${bold("insert")}: 
${joinActions(insertions)}`
  );

  console.log(
    `\n* Found ${bold(updations.length)} objects to ${bold("update")}: 
${joinActions(updations)}`
  );

  console.log(
    `\n* Found ${bold(deletions.length)} objects to ${bold("delete")}: 
${joinActions(deletions)}`
  );
}

export enum SendingPromiseStrategy {
  All,
  OneByOne,
  Batch,
  Retry
}

function spinUntilPromiseEnd(promiseFactories: (() => Promise<any>)[], label: string) {
  if (!promiseFactories.length) {
    return;
  }

  return spin({
    text: label,
    op: async spinner => {
      let progress = 0;
      let count = 0;

      const concurrency = Math.min(promiseFactories.length, CONCURRENCY_LIMIT);

      let batchPromises = [];
      for (let i = 0; i < promiseFactories.length; i++) {
        batchPromises.push(promiseFactories[i]);

        // if it reaches the concurrency limit or the last index
        if (batchPromises.length == concurrency || i == promiseFactories.length - 1) {
          await Promise.all(batchPromises.map(b => b()));
          batchPromises = [];
        }

        count++;
        progress = (100 / promiseFactories.length) * count;
        spinner.text = `${label} (%${Math.round(progress)})`;
      }

      return;
    }
  });
}

function handleRejection({action, objectName, message}) {
  const msg: any = `
Failed to ${action} ${bold(objectName)}.
${message}`;

  if (IGNORE_ERRORS) {
    return console.warn(msg);
  } else {
    return Promise.reject(msg);
  }
}

function returnErrorMessage(e) {
  return e.data ? e.data.message || e.data : e;
}

function isNotFoundException(e) {
  const code = 404;
  return e.status == code || e.statusCode == code || (e.data && e.data.statusCode == code);
}
