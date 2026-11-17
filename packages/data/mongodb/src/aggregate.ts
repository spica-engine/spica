import {AggregateOptions, Collection, Document} from "@spica-server/database";
import {AggregatableCollection} from "@spica-server/interface-database";

// Services read through BaseCollection, whose aggregate allows spilling large stages to disk.
export const AGGREGATE_OPTIONS: AggregateOptions = {allowDiskUse: true};

export function aggregatable(collection: Collection<Document>): AggregatableCollection {
  return {
    aggregate: <T>(pipeline: object[]) => collection.aggregate<T>(pipeline, AGGREGATE_OPTIONS)
  };
}
