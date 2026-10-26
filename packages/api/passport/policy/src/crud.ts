import {ids} from "@spica-server/data";
import {Id} from "@spica-server/interface-data";
import {PolicyService} from "./policy.service.js";
import {changeFactory, Policy} from "@spica-server/interface-passport-policy";
import {BadRequestException, NotFoundException} from "@nestjs/common";
import {createDuplicatedActionsErrorMessage, getDuplicatedActionMaps} from "./utility.js";

export async function find(ps: PolicyService, filter: object, limit?: number, skip?: number) {
  return ps.paginate(filter, limit, skip);
}

const policyIds = () => ids().forCollection("policies");

export function findOne(ps: PolicyService, id: Id) {
  return ps.findOne(id);
}

export async function insert(ps: PolicyService, body: Policy) {
  const duplicatedActionMaps = getDuplicatedActionMaps(body);

  if (duplicatedActionMaps.length) {
    const message = createDuplicatedActionsErrorMessage(duplicatedActionMaps);
    throw new BadRequestException(message);
  }
  if (body._id) {
    body._id = policyIds().parse(body._id);
  }
  return ps.insertOne(body);
}

export async function replace(ps: PolicyService, policy: Policy) {
  const duplicatedActionMaps = getDuplicatedActionMaps(policy);

  if (duplicatedActionMaps.length) {
    const message = createDuplicatedActionsErrorMessage(duplicatedActionMaps);
    throw new BadRequestException(message);
  }

  const _id = policyIds().parse(policy._id);
  delete policy._id;
  const res = await ps.replaceOne({_id}, policy);

  if (!res) {
    throw new NotFoundException(`Policy with ID ${_id} not found`);
  }
  return res;
}

export async function remove(
  ps: PolicyService,
  id: Id,
  apikeyFinalizer: changeFactory,
  identityFinalizer: changeFactory
) {
  if (apikeyFinalizer) {
    await apikeyFinalizer(id.toString());
  }

  if (identityFinalizer) {
    await identityFinalizer(id.toString());
  }

  const res = await ps.deleteOne({_id: id as any});

  if (!res) {
    throw new NotFoundException(`Policy with ID ${id} not found`);
  }
  return res;
}
