import {
  DocChange,
  DocumentManagerResource,
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

  const convertToRepResource = (change: DocChange<DocumentManagerResource<Policy>>) => ({
    _id: change.resource._id || change.resource.content._id?.toString(),
    slug: change.resource.slug || change.resource.content.name,
    content: YAML.stringify(change.resource.content)
  });

  const convertToDocResource = (change: RepChange<RepresentativeManagerResource>) => {
    const parsed = change.resource.content ? YAML.parse(change.resource.content) : {};
    const id = parsed._id || change.resource._id;
    return {...parsed, _id: new ObjectId(id)};
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
          delete: (policy: Policy) =>
            CRUD.remove(ps, policy._id as unknown as ObjectId, undefined, undefined)
        }
      }
    ],
    moduleName: "policy",
    subModuleName: "schema"
  };
};
