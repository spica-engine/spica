import {
  AggregatableCollection,
  PaginationPlan,
  PaginationResult
} from "@spica-server/interface-database";

export function executePaginationPlan<T>(
  collection: AggregatableCollection,
  plan: PaginationPlan
): Promise<PaginationResult<T>> {
  const data = collection.aggregate<T>(plan.dataPipeline).toArray();

  const total = plan.countPipeline
    ? collection
        .aggregate<{total: number}>(plan.countPipeline)
        .next()
        .then(result => (result ? result.total : 0))
    : plan.estimateTotalDocumentCount();

  return Promise.all([data, total]).then(([data, total]) => ({meta: {total}, data}));
}
