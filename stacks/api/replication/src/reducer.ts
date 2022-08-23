import {Injectable} from "@nestjs/common";
import {JobService} from "./database/job";
import {IJobReducer, JobMeta} from "./interface";

@Injectable()
export class JobReducer implements IJobReducer {
  constructor(private service: JobService) {}

  do(meta: JobMeta, job: Function) {
    return this.service._coll
      .updateOne(meta, {$setOnInsert: meta}, {upsert: true})
      .then(({upsertedCount}) => {
        if (!upsertedCount) {
          return false;
        }

        job();
        return true;
      });
  }
}
