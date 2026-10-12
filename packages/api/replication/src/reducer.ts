import {Injectable} from "@nestjs/common";
import {JobService} from "./database/job.js";
import {IJobReducer, JobMeta} from "@spica-server/interface-replication";
import {Filter} from "@spica-server/database";

@Injectable()
export class JobReducer implements IJobReducer {
  constructor(private service: JobService) {}

  /**
   * Let only **one** replica run the job. The winner of the race is the replica that actually **inserts**
   * the record.
   *
   * It used to look at `upsertedCount` on Mongo's `updateOne` result; in the driver contract `updateOne`
   * returns only the number of affected rows and that does not tell "I inserted" from "I matched". The
   * neutral counterpart is `returnDocument: "before"`: when an upsert inserts there is no previous
   * document (`null`), and when it matches there is. It works the same way on both backends.
   */
  do(meta: JobMeta, job: Function) {
    return this.service
      .findOneAndUpdate(
        {_id: meta._id},
        {$setOnInsert: meta},
        {upsert: true, returnDocument: "before"}
      )
      .catch(e => {
        // This error appears when the replicas fire at the same time (before the upsert finishes); for the
        // losing replica it means "somebody else took the job", so we treat it like an existing document.
        if (e.code == 11000) {
          return {} as any;
        }
        throw Error(e);
      })
      .then(previous => {
        if (previous) {
          return false;
        }

        job();
        return true;
      });
  }

  findOneAndDelete(filter: Filter<JobMeta>) {
    return this.service.findOneAndDelete(filter);
  }
}
