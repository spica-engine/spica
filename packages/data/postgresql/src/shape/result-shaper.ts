import {Injectable} from "@nestjs/common";
import {ResourceRef, ResultShaper, ShapeOptions} from "@spica-server/interface-data";
import {BucketDescriptions} from "./descriptions.js";
import {isRowSet, RowSet} from "./row-set.js";
import {BucketShaper} from "./shaper.js";

type Container = RowSet | RowSet[] | {data: RowSet[]} | null | undefined;

function rowSetsOf(input: Container): RowSet[] {
  if (Array.isArray(input)) {
    return input;
  }
  if (isRowSet(input)) {
    return [input];
  }
  return Array.isArray((input as {data?: RowSet[]})?.data) ? (input as {data: RowSet[]}).data : [];
}

function rebuild(input: Container, convert: (rowSet: RowSet) => unknown): unknown {
  if (Array.isArray(input)) {
    return input.map(convert);
  }
  if (isRowSet(input)) {
    return convert(input);
  }
  return Array.isArray((input as {data?: RowSet[]})?.data)
    ? {...input, data: (input as {data: RowSet[]}).data.map(convert)}
    : input;
}

@Injectable()
export class PostgresResultShaper implements ResultShaper {
  private readonly shaper = new BucketShaper();

  constructor(private readonly descriptions: BucketDescriptions) {}

  async shape<I, O = I>(resource: ResourceRef, input: I, options?: ShapeOptions): Promise<O> {
    if (resource.kind != "bucket") {
      return input as unknown as O;
    }
    const rowSets = rowSetsOf(input as Container);
    if (!rowSets.length) {
      return rebuild(input as Container, () => undefined) as O;
    }
    const describe = await this.descriptions.load(resource.bucketId, rowSets);
    const description = describe(resource.bucketId);
    const environment = {describe, locale: options?.locale};
    return rebuild(input as Container, rowSet =>
      this.shaper.shape(rowSet, description, environment)
    ) as O;
  }
}
