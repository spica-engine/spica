import {DatabaseService, BaseCollection, FilterQuery} from "@spica-server/database";
import {Resource} from "./definition";
import {GroupResource} from "./scheme";

let db: DatabaseService;

/**
 * Do not use this function if you do not know what you are doing.
 */
export function __setDb(databaseService: DatabaseService) {
  db = databaseService;
}

class ObjectStore extends BaseCollection<Resource<unknown, unknown>>("objects") {}

type DeepPartial<T> = {
  [P in keyof T]?: DeepPartial<T[P]>;
};

export function store<SpecType = unknown, StatusType = unknown>(groupResource?: GroupResource) {
  return new Store<SpecType, StatusType>(groupResource);
}

class Store<SpecType = unknown, StatusType = unknown> {
  private store = new ObjectStore(db);
  private groupKey: string;

  constructor(groupResource?: GroupResource) {
    if (groupResource) {
      this.groupKey = `${groupResource.group}ɵ${groupResource.resource}`;
    }
  }

  async find(filter: FilterQuery<Resource<SpecType, StatusType>>) {
    return this.store.find(filter);
  }

  async get(name: string): Promise<Resource<SpecType, StatusType>> {
    const result = (await this.store.findOne({
      _id: `${this.groupKey}ɵ${name}`
    })) as Resource<SpecType, StatusType>;
    if (result) {
      // it is there. i know it
      delete result["_id"];
    }
    return result;
  }

  async set(name: string, value: Resource<SpecType, StatusType>): Promise<void> {
    value["_id"] = `${this.groupKey}ɵ${name}`;
    await this.store.replaceOne({_id: value["_id"]}, value, {
      upsert: true
    });
  }

  async patch(name: string, patch: DeepPartial<Resource<SpecType, StatusType>>) {
    const unset = {};
    const set = {};

    const visit = (partialPatch: any, base: string = "") => {
      for (const name in partialPatch) {
        const key = base ? `${base}.${name}` : name;
        const value = partialPatch[name];
        const type = typeof value;

        if (value == null) {
          unset[key] = "";
        } else if (type == "boolean" || type == "string" || type == "number" || type == "bigint") {
          set[key] = value;
        } else if (Array.isArray(value)) {
          set[key] = value;
        } else if (typeof value == "object") {
          visit(value, key);
        }
      }
    };

    visit(patch);

    let result: any = {};

    if (Object.keys(set).length) {
      result.$set = set;
    }

    if (Object.keys(unset).length) {
      result.$unset = unset;
    }

    if (!Object.keys(result).length) {
      return;
    }

    await this.store.updateOne({_id: `${this.groupKey}ɵ${name}`}, result);
  }

  async deleteByFilter(filter: any) {
    return this.store.deleteMany(filter);
  }

  async delete(name: string) {
    await this.store.deleteOne({_id: `${this.groupKey}ɵ${name}`});
  }

  async has(name: string): Promise<boolean> {
    const result = await this.store.findOne({_id: `${this.groupKey}ɵ${name}`});
    return !!result;
  }

  async values(): Promise<IterableIterator<Resource<SpecType, StatusType>>> {
    const result = await this.store
      .aggregate([
        {
          $match: {
            _id: new RegExp(`^${this.groupKey}`)
          }
        },
        {
          $unset: ["_id"]
        }
      ])
      .toArray();
    return result[Symbol.iterator]() as IterableIterator<Resource<SpecType, StatusType>>;
  }
}
