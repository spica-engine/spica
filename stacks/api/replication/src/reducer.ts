import {Injectable} from "@nestjs/common";
import {JobService} from "./database/job";
import {IJobReducer, JobMeta} from "./interface";

@Injectable()
export class JobReducer implements IJobReducer {
  constructor(private service: JobService) {}

  do(meta: JobMeta, job: Function) {
    return this.service._coll
      .updateOne(meta, {$setOnInsert: meta}, {upsert: true})
      .catch(e => {
        // If replicas are triggered at the same time(before upsert completion), this error occurs.
        // for this case, we can ignore the error since we know one of replicas already took the job
        if (e.code == 11000) {
          return {upsertedCount: 0};
        }
        throw Error(e);
      })
      .then(({upsertedCount}) => {
        if (!upsertedCount) {
          return false;
        }

        job();
        return true;
      });
  }
}
