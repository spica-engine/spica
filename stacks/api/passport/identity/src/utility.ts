import {IdentityService} from "./identity.service";

export function attachIdentityAccess(request: any) {
  if (
    request.method == "PUT" &&
    request.params.id == request.user._id &&
    !request.user.policies.includes("IdentityFullAccess")
  ) {
    request.user.policies.push("IdentityFullAccess");
  }
  return request;
}

export function provideSettingsFinalizer(identityService: IdentityService) {
  return (previousSchema: any, currentSchema: any) => {
    let updatedFields = findUpdatedFields(
      previousSchema.identity.attributes.properties,
      currentSchema.identity.attributes.properties,
      [],
      ""
    );

    if (updatedFields.length < 1) return;

    let unsetFields = updatedFields.reduce((acc, current) => {
      let fieldName = "attributes." + current;
      acc = {...acc, [fieldName]: ""};
      return acc;
    }, {});

    return identityService.updateMany({}, {$unset: unsetFields});
  };
}

export function findUpdatedFields(
  previousSchema: any,
  currentSchema: any,
  updatedFields: string[],
  path: string
) {
  if (!previousSchema) {
    return [];
  }
  for (const field of Object.keys(previousSchema)) {
    if (
      !currentSchema.hasOwnProperty(field) ||
      currentSchema[field].type != previousSchema[field].type
    ) {
      updatedFields.push(path ? `${path}.${field}` : field);
      //we dont need to check child keys of this key anymore
      continue;
    }
    if (isObject(previousSchema[field]) && isObject(currentSchema[field])) {
      findUpdatedFields(
        previousSchema[field].properties,
        currentSchema[field].properties,
        updatedFields,
        path ? `${path}.${field}` : field
      );
    } else if (isArray(previousSchema[field]) && isArray(currentSchema[field])) {
      addArrayPattern(
        previousSchema[field].items,
        currentSchema[field].items,
        updatedFields,
        path ? `${path}.${field}` : field
      );
    }
  }
  return updatedFields;
}

export function addArrayPattern(
  previousSchema: any,
  currentSchema: any,
  updatedFields: string[],
  path: string
) {
  path = `${path}.$[]`;
  if (isArray(previousSchema) && isArray(currentSchema)) {
    addArrayPattern(previousSchema.items, currentSchema.items, updatedFields, path);
  } else if (isObject(previousSchema) && isObject(currentSchema)) {
    findUpdatedFields(previousSchema.properties, currentSchema.properties, updatedFields, path);
  }
}

export function isObject(schema: any) {
  return schema.type == "object";
}

export function isArray(schema: any) {
  return schema.type == "array";
}
