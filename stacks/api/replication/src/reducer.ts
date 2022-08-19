import { Inject } from "@nestjs/common";
import { ProcessService } from "./database/process";
import { IRedundancyChecker, JobMeta, REPLICA_ID } from "./interface";


export class RedundancyChecker implements IRedundancyChecker {

    constructor(private service: ProcessService) { }

    isRedundant(jobMeta: JobMeta): Promise<boolean> {
        return this.service._coll.updateOne(jobMeta, { $setOnInsert: jobMeta }, { upsert: true }).then(r => r.upsertedCount == 0)
    }
}