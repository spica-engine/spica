import {Injectable} from "@nestjs/common";
import {bufferTime, filter, from, map, mergeMap, Observable} from "rxjs";
import {
  ChangeLog,
  IChangeLogProcessor,
  ChangeOrigin,
  ChangeType
} from "@spica-server/interface/versioncontrol";
import {ChangeLogAggregator} from "./interface";
import {ChangeLogService} from "@spica-server/versioncontrol/services/changelog";

@Injectable()
export class ChangeLogProcessor implements IChangeLogProcessor {
  // refactor here
  private readonly renameAggregator: ChangeLogAggregator = logs => {
    for (let i = 0; i < logs.length; i++) {
      const log = logs[i];
      const isRepLog = log.origin == ChangeOrigin.REPRESENTATIVE;
      if (!isRepLog) continue;

      const aggregate = (type1: ChangeType, type2: ChangeType) => {
        const isType1 = log.type == type1;
        if (isType1) {
          const type2LogOfSameLogIndex = logs.findIndex(
            l =>
              l.module == log.module &&
              l.sub_module == log.sub_module &&
              l.resource_id == log.resource_id &&
              l.type == type2
          );

          if (type2LogOfSameLogIndex != -1) {
            logs.splice(type2LogOfSameLogIndex, 1);
            logs[i] = {
              ...log,
              type: ChangeType.UPDATE
            };
          }
        }
      };

      aggregate(ChangeType.CREATE, ChangeType.DELETE);
      aggregate(ChangeType.DELETE, ChangeType.CREATE);
    }
    return logs;
  };
  private readonly aggregators: ChangeLogAggregator[] = [this.renameAggregator];

  constructor(private readonly service: ChangeLogService) {}

  async push(changeLog: ChangeLog) {
    let wasReflection;

    wasReflection = await this.manageChangeReflection(changeLog).then(res => res.wasReflection);

    if (wasReflection) {
      return;
    }

    return this.service.insertOne(changeLog);
  }

  watch(): Observable<ChangeLog> {
    return this.service
      .watch([{$match: {operationType: "insert"}}], {fullDocument: "updateLookup"})
      .pipe(
        map(change => {
          const doc = change["fullDocument"] as any;
          return doc as ChangeLog;
        }),
        bufferTime(2000),
        filter(logs => logs.length > 0),
        map(logs => this.aggregators.reduce((acc, aggregator) => aggregator(acc), logs)),
        mergeMap(aggregatedLogs => from(aggregatedLogs))
      );
  }

  private manageChangeReflection(changeLog: ChangeLog): Promise<{wasReflection: boolean}> {
    const filter = {
      type: changeLog.type,
      module: changeLog.module,
      sub_module: changeLog.sub_module,
      resource_id: changeLog.resource_id,
      origin:
        changeLog.origin === ChangeOrigin.DOCUMENT
          ? ChangeOrigin.REPRESENTATIVE
          : ChangeOrigin.DOCUMENT
    };

    const options = {
      sort: {_id: -1 as const}
    };

    return this.service
      .findOneAndDelete(filter, options)
      .then(result => ({wasReflection: !!result}));
  }
}
