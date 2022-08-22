import {Injectable} from "@nestjs/common";
import {JobService} from "./database/process";
import {IJobReducer, JobMeta} from "./interface";

@Injectable()
export class JobReducer implements IJobReducer {
  constructor(private service: JobService) {}

  do(meta: JobMeta, job: Function): Promise<any> {
    return this.service._coll
      .updateOne(meta, {$setOnInsert: meta}, {upsert: true})
      .then(({upsertedCount}) => {
        if (!upsertedCount) {
          return;
        }
        return job();
      });
  }
}
