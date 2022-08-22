import {Injectable} from "@nestjs/common";
import {JobService} from "./database/job";
import {IJobReducer, JobMeta} from "./interface";

@Injectable()
export class JobReducer implements IJobReducer {
  constructor(private service: JobService) {}

  do(meta: JobMeta, job: Function): Promise<any> {
    meta.created_at = new Date();
    return this.service._coll
      .updateOne({_id: meta._id}, {$setOnInsert: meta}, {upsert: true})
      .then(({upsertedCount}) => {
        if (!upsertedCount) {
          return;
        }
        return job();
      });
  }
}
