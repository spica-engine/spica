import {BadRequestException} from "@nestjs/common";
import {ObjectId} from "@spica-server/database";
import {BucketReadSpec, FilterNode} from "@spica-server/interface-bucket-common";

const castId = (value: unknown): unknown =>
  Array.isArray(value) ? value.map(castId) : new ObjectId(value as string);

export function renderWhere(node: FilterNode): object {
  if ("and" in node) {
    return {$and: node.and.map(renderWhere)};
  }
  if ("or" in node) {
    return {$or: node.or.map(renderWhere)};
  }
  const value = node.id ? castId(node.value) : node.value;
  return {[node.path.join(".")]: node.operator == "eq" ? value : {[`$${node.operator}`]: value}};
}

export function filterOf(spec: BucketReadSpec): BucketReadSpec["filter"] {
  if (!spec.where) {
    return spec.filter;
  }
  const where = renderWhere(spec.where);
  if (spec.filter === undefined || spec.filter === null) {
    return where;
  }
  if (typeof spec.filter == "object") {
    return {$and: [spec.filter, where]};
  }
  throw new BadRequestException("An expression filter cannot be combined with a query.");
}
