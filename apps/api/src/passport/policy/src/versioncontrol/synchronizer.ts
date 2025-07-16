import {
  DocChange,
  RepChange,
  RepresentativeManagerResource,
  VCSynchronizerArgs
} from "@spica-server/interface/versioncontrol";
import * as CRUD from "../crud";
import {PolicyService} from "@spica-server/passport/policy";
import {Policy} from "@spica-server/interface/passport/policy";
import YAML from "yaml";
import {ObjectId} from "bson";

export const getSynchronizer = (ps: PolicyService): VCSynchronizerArgs<Policy> => {
  const fileName = "schema";
  const extension = "yaml";

  const convertToRepResource = (change: DocChange<Policy>) => ({
    _id: change.resource._id.toString(),
    content: YAML.stringify(change.resource)
  });

  const convertToDocResource = (change: RepChange<RepresentativeManagerResource>) => {
    const parsed = change.resource.content ? YAML.parse(change.resource.content) : {};
    return {...parsed, _id: new ObjectId(change.resource._id)};
  };

  return {
    syncs: [
      {
        watcher: {collectionService: ps},
        converter: {convertToRepResource},
        applier: {fileName, getExtension: () => extension}
      },
      {
        watcher: {filesToWatch: [{name: fileName, extension}]},
        converter: {convertToDocResource},
        applier: {
          insert: (policy: Policy) => CRUD.insert(ps, policy),
          update: (policy: Policy) => CRUD.replace(ps, policy),
          delete: (policy: Policy) => CRUD.remove(ps, policy._id as unknown as ObjectId)
        }
      }
    ],
    moduleName: "policy",
    subModuleName: "schema"
  };
};
