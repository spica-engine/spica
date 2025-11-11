import {
  ChangeSupplier,
  ChangeApplier,
  ChangeType,
  ChangeLog,
  ApplyResult
} from "@spica/interface/versioncontrol";
import {Observable} from "rxjs";
import {PolicyService} from "../../src/policy.service";
import {parse, stringify} from "yaml";
import {Policy} from "@spica/interface/passport/policy";

export function policySupplier(ps: PolicyService): ChangeSupplier {
  return {
    module: "passport",
    subModule: "policy",it
    listen: () => {
      return new Observable(observer => {
        const stream = ps._coll.watch([], {
          fullDocument: "updateLookup"
        });

        stream.on("change", change => {
          let type: ChangeType;

          if (change.operationType == "insert") {
            type = ChangeType.INSERT;
          } else if (change.operationType == "update") {
            type = ChangeType.UPDATE;
          } else if (change.operationType == "delete") {
            type = ChangeType.DELETE;
          } else {
            return;
          }

          const policy = change.fullDocument as Policy;
          const policyId = change.documentKey._id.toString();

          const changeLog: ChangeLog = {
            type,
            resource_slug: policy ? policy.name : policyId,
            resource_id: policyId,
            file_extension: "yaml"
          };

          if (type != ChangeType.DELETE) {
            changeLog.content = stringify(policy);
          }

          observer.next(changeLog);
        });

        stream.on("error", error => observer.error(error));

        return () => stream.close();
      });
    }
  };
}

export function policyApplier(ps: PolicyService): ChangeApplier {
  return {
    module: "passport",
    subModule: "policy",
    fileExtension: "yaml",
    apply: async (changeLog: ChangeLog) => {
      const result: ApplyResult = {
        resource_id: changeLog.resource_id,
        type: changeLog.type
      };

      try {
        switch (changeLog.type) {
          case ChangeType.INSERT:
            const policyToInsert = parse(changeLog.content) as Policy;
            const insertedPolicy = await ps.insertOne(policyToInsert);
            result.resource_id = insertedPolicy._id.toString();
            break;

          case ChangeType.UPDATE:
            const policyToUpdate = parse(changeLog.content) as Policy;
            await ps.findOneAndReplace({_id: changeLog.resource_id}, policyToUpdate);
            break;

          case ChangeType.DELETE:
            await ps.deleteOne({_id: changeLog.resource_id});
            break;

          default:
            throw new Error(`Unknown change type: ${changeLog.type}`);
        }

        result.succeed = true;
      } catch (error) {
        result.succeed = false;
        result.error = error.message || error.toString();
      }

      return result;
    }
  };
}
