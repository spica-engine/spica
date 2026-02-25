import {ObjectId, ReturnDocument} from "@spica-server/database";
import {PolicyService} from "./policy.service";
import {changeFactory, Policy} from "@spica-server/interface/passport/policy";
import {BadRequestException, NotFoundException} from "@nestjs/common";
import {createDuplicatedActionsErrorMessage, getDuplicatedActionMaps} from "./utility";

export async function find(ps: PolicyService, filter: object, limit?: number, skip?: number) {
  return ps.paginate(filter, limit, skip);
}

export function findOne(ps: PolicyService, id: ObjectId) {
  return ps.findOne(id);
}

export async function insert(ps: PolicyService, body: Policy) {
  const duplicatedActionMaps = getDuplicatedActionMaps(body);

  if (duplicatedActionMaps.length) {
    const message = createDuplicatedActionsErrorMessage(duplicatedActionMaps);
    throw new BadRequestException(message);
  }
  if (body._id) {
    body._id = new ObjectId(body._id);
  }
  return ps.insertOne(body);
}

export async function replace(ps: PolicyService, policy: Policy) {
  const duplicatedActionMaps = getDuplicatedActionMaps(policy);

  if (duplicatedActionMaps.length) {
    const message = createDuplicatedActionsErrorMessage(duplicatedActionMaps);
    throw new BadRequestException(message);
  }

  const _id = new ObjectId(policy._id);
  delete policy._id;
  const res = await ps.replaceOne({_id}, policy);

  if (!res) {
    throw new NotFoundException(`Policy with ID ${_id} not found`);
  }
  return res;
}

export async function remove(
  ps: PolicyService,
  id: ObjectId,
  apikeyFinalizer: changeFactory,
  identityFinalizer: changeFactory
) {
  if (apikeyFinalizer) {
    await apikeyFinalizer(id.toHexString());
  }

  if (identityFinalizer) {
    await identityFinalizer(id.toHexString());
  }

  const res = await ps.deleteOne({_id: id as any});

  if (!res) {
    throw new NotFoundException(`Policy with ID ${id} not found`);
  }
  return res;
}
