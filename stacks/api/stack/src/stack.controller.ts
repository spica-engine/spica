import {
  ArgumentsHost,
  Body,
  Catch,
  Controller,
  ExceptionFilter,
  Get,
  Param,
  Patch,
  Post,
  Put,
  UseFilters,
  UseInterceptors
} from "@nestjs/common";
import {Resource, ResourceDefinition} from "./definition";
import {PatchBodyParser} from "./patch";
import { findSchemeByGroupAndResource, makeKey } from "./scheme";
import {alreadyExists, isStatusKind, notFound, status} from "./status";


function setMetadataFields(resource: Resource) {
  if (!resource.metadata.creationTimestamp) {
    resource.metadata.creationTimestamp = new Date().toISOString();
  }
}

function callNotifiers(resource: Resource, objects: Map<string, Resource<unknown>>) {
  return globalThis["notify"](resource, objects);
}

function reviewBucketSchema(
  definition: ResourceDefinition,
  objects: Map<string, Resource<unknown>>,
  resource: Resource<any>
) {
  const {spec, metadata} = resource;
  for (const propertyName in spec.properties) {
    const property = spec.properties[propertyName];
    if (property.type == "relation" && typeof property.bucket == "object") {
      const bucketName = property.bucket.valueFrom.resourceFieldRef.bucketName;
      // TODO: handle downwards resources via generic function
      if (!objects.has(bucketName)) {
        throw notFound({
          message: `${definition.names.plural} "${bucketName}" could not be found.`,
          details: {
            kind: definition.names.kind,
            name: bucketName
          }
        });
      }
    }
  }
}


@Catch()
export class StatusFilter implements ExceptionFilter {
  catch(exceptionOrStatus: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<any>();
    if (!isStatusKind(exceptionOrStatus)) {
      exceptionOrStatus = status({
        code: 500,
        message: exceptionOrStatus["message"] ? exceptionOrStatus["message"] : "unknown error",
        status: "Failure",
        reason: "InternalError"
      });
    }

    if (isStatusKind(exceptionOrStatus)) {
      response.status(exceptionOrStatus.code).json(exceptionOrStatus);
    }
  }
}

@UseFilters(new StatusFilter())
@Controller("apis")
export class StackController {
  store = new Map<string, Map<string, Resource<unknown>>>();

  // healthz
  // version
  // metrics

  @Get()
  apiGroups() {
    return definitions;
  }

  // @Get(":group")
  // apiGroup(@Param("group") groupName: string) {
  //   return {
  //     kind: "APIGroup",
  //     apiVersion: "v1",
  //     name: groupName,
  //     versions: ["v1beta2"]
  //   };
  // }

  // @Get(":group/:version")
  // apiResources(@Param("group") groupName: string, @Param("version") version: string) {
  //   return {
  //     kind: "APIResourceList",
  //     apiVersion: "v1",
  //     groupVersion: version,
  //     resources: [
  //       {
  //         name: "managedcertificates",
  //         singularName: "managedcertificate",
  //         kind: "ManagedCertificate",
  //         shortNames: ["mcrt"]
  //       }
  //     ]
  //   };
  // }

  @Get(":group/:version/:resource")
  list(
    @Param("group") group: string,
    @Param("version") versionName: string,
    @Param("resource") resourceName: string
  ) {
    const key = makeKey(group, resourceName)

    const objects = this.store.has(key) ? this.store.get(key) : new Map();

    return Array.from(objects.values());
  }

  @Get(":group/:version/:resource/:name")
  get(
    @Param("group") group: string,
    @Param("version") versionName: string,
    @Param("resource") resourceName: string,
    @Param("name") objectName: string
  ) {
    const groupAndResource = {
      group,
      resource: resourceName
    };

    const key = makeKey(groupAndResource)


    const objects = this.store.has(key) ? this.store.get(key) : new Map();

    return objects.get(objectName);
  }

  @Post(":group/:version/:resource")
  async add(
    @Param("group") group: string,
    @Param("version") version: string,
    @Param("resource") resourceName: string,
    @Body() object: Resource
  ) {

    const groupAndResource = {
      group,
      resource: resourceName
    };

    const key = makeKey(groupAndResource)

    const {definition} = findSchemeByGroupAndResource(groupAndResource);

    const objects = this.store.has(key)
      ? this.store.get(key)
      : this.store.set(key, new Map<string, Resource<unknown>>()).get(key);

    const objectName = object.metadata.name;

    if (objects.has(objectName)) {
      throw alreadyExists({
        message: `${definition.names.plural} "${objectName}" already exists.`,
        details: {
          kind: definition.names.kind,
          name: objectName
        }
      });
    }

    setMetadataFields(object);

    reviewBucketSchema(definition, objects, object);

    await callNotifiers(object, objects);

    objects.set(objectName, object);

    return objects;
  }

  @Put(":group/:version/:resource/:name")
  async replace(
    @Param("group") group: string,
    @Param("version") versionName: string,
    @Param("resource") resourceName: string,
    @Param("name") objectName: string,
    @Body() object: Resource
  ) {
    const groupAndResource = {
      group,
      resource: resourceName
    };

    const key = makeKey(groupAndResource)

    const {definition} = findSchemeByGroupAndResource(groupAndResource);

    const objects = this.store.has(key)
      ? this.store.get(key)
      : this.store.set(key, new Map<string, Resource<unknown>>()).get(key);

    if (!objects.has(objectName)) {
      throw notFound({
        message: `${definition.names.plural} "${objectName}" could not be found.`,
        details: {
          kind: definition.names.kind,
          name: objectName
        }
      });
    }

    reviewBucketSchema(definition, objects, object);

    const obj = objects.get(objectName);

    obj.spec = object.spec;

    console.log(obj);

    await callNotifiers(obj, objects);

    objects.set(objectName, obj);

    return objects;
  }

  @UseInterceptors(PatchBodyParser())
  @Patch(":group/:version/:resource/:name")
  patch(
    @Param("group") group: string,
    @Param("version") versionName: string,
    @Param("resource") resourceName: string,
    @Param("name") objectName: string,
    @Body() object: Resource
  ) {
    const groupAndResource = {
      group,
      resource: resourceName
    };

    const key = makeKey(groupAndResource)

    const {definition} = findSchemeByGroupAndResource(groupAndResource);

    const objects = this.store.has(key) ? this.store.get(key) : new Map();

    if (objects.has(objectName)) {
      throw alreadyExists({
        message: `${definition.names.plural} "${objectName}" already exists.`,
        details: {
          kind: definition.names.kind,
          name: objectName
        }
      });
    }

    objects.set(objectName, object);

    return objects;
  }
}
