import {Inject, Injectable} from "@nestjs/common";
import {Orm} from "@spica-server/data-postgresql-orm";
import {Bucket} from "@spica-server/interface-bucket";
import {StoredBuckets} from "../repositories/bucket/stored-buckets.js";
import {ORM} from "../orm.js";
import {describeBucket, relationTargets, resolveRelationTargets} from "../schema/index.js";
import {itemsOf, Property} from "../schema/metadata/property.js";
import {RowSet} from "./row-set.js";
import {BucketDescription, ShapeEnvironment} from "./scope.js";

type Describe = ShapeEnvironment["describe"];

interface Pending {
  bucketId: string;
  rowSets: RowSet[];
}

function propertyAt(definition: Bucket, path: string[]): Property | undefined {
  let properties = definition.properties as Record<string, Property> | undefined;
  let property: Property | undefined;
  for (const segment of path) {
    property = properties?.[segment];
    const holder = property?.properties ? property : itemsOf(property ?? ({} as Property));
    properties = holder?.properties as Record<string, Property> | undefined;
  }
  return property;
}

const rowSetsOf = (value: RowSet | RowSet[] | null | undefined): RowSet[] =>
  value == null ? [] : Array.isArray(value) ? value : [value];

@Injectable()
export class BucketDescriptions {
  private readonly stored: StoredBuckets;

  constructor(@Inject(ORM) orm: Orm) {
    this.stored = new StoredBuckets(orm);
  }

  async load(bucketId: string, rowSets: RowSet[]): Promise<Describe> {
    const found = new Map<string, Promise<Bucket | null>>();
    const find = (id: string) => {
      if (!found.has(id)) {
        found.set(id, this.stored.find(id));
      }
      return found.get(id);
    };
    const described = new Map<string, BucketDescription>();
    const describe = async (id: string) => {
      if (!described.has(id)) {
        const definition = await find(id);
        if (!definition) {
          throw new Error(`The bucket "${id}" does not exist.`);
        }
        const targets = await resolveRelationTargets(definition, find);
        described.set(id, {definition, metadata: describeBucket(id, definition, targets)});
      }
      return described.get(id);
    };

    const pending: Pending[] = [{bucketId, rowSets}];
    while (pending.length) {
      const next = pending.pop();
      const {definition} = await describe(next.bucketId);
      for (const targetId of relationTargets(definition.properties)) {
        await describe(targetId);
      }
      for (const rowSet of next.rowSets) {
        for (const [path, joined] of Object.entries(rowSet.joined ?? {})) {
          const property = propertyAt(definition, path.split(".")) as Property & {bucketId: string};
          pending.push({bucketId: property.bucketId, rowSets: rowSetsOf(joined)});
        }
      }
    }

    return id => {
      const description = described.get(id);
      if (!description) {
        throw new Error(`The bucket "${id}" was not loaded for shaping.`);
      }
      return description;
    };
  }
}
