import {Inject, Injectable} from "@nestjs/common";
import {
  IJobReducer,
  JOB_REPOSITORY,
  JobMeta,
  JobRepository
} from "@spica-server/interface-replication";

@Injectable()
export class JobReducer implements IJobReducer {
  constructor(@Inject(JOB_REPOSITORY) private jobs: JobRepository) {}

  async do(meta: JobMeta, job: Function) {
    if (!(await this.jobs.claim(meta))) {
      return false;
    }

    job();
    return true;
  }

  takeByEventId(eventId: string) {
    return this.jobs.takeByEventId(eventId);
  }
}
