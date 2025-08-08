import {ObjectId, ReturnDocument} from "../../../../../../libs/database";
import {PolicyService} from "./policy.service";
import {Policy} from "../../../../../../libs/interface/passport/policy";
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

  return ps.insertOne(body);
}

export async function replace(ps: PolicyService, policy: Policy) {
  const duplicatedActionMaps = getDuplicatedActionMaps(policy);

  if (duplicatedActionMaps.length) {
    const message = createDuplicatedActionsErrorMessage(duplicatedActionMaps);
    throw new BadRequestException(message);
  }
  const res = await ps.replaceOne({_id: policy._id}, policy);

  if (!res) {
    throw new NotFoundException(`Policy with ID ${policy._id} not found`);
  }
  return res;
}

export async function remove(ps: PolicyService, id: ObjectId) {
  if (this.apikeyFinalizer) {
    await this.apikeyFinalizer(id.toHexString());
  }

  if (this.identityFinalizer) {
    await this.identityFinalizer(id.toHexString());
  }

  const res = await ps.deleteOne({_id: id as any});

  if (!res) {
    throw new NotFoundException(`Policy with ID ${id} not found`);
  }
  return res;
}
