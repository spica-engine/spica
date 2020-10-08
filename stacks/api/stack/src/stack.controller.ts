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
import {definitions} from "./definitions";
import {PatchBodyParser} from "./patch";
import {alreadyExists, isStatusKind, notFound, status} from "./status";

function doesTheNameMatchDefinition(name: string, definition: ResourceDefinition) {
  return definition.names.plural == name;
}

function getVersion(version: string, definition: ResourceDefinition) {
  return definition.versions.find(def => def.name == version);
}

function setMetadataFields(resource: Resource) {
  if (! resource.metadata.creationTimestamp ) {
    resource.metadata.creationTimestamp = new Date().toISOString();
  }
}

function callNotifiers(resource: Resource, objects: Map<string, Resource<unknown>>) {
  return globalThis['notify'](resource, objects);
}


function reviewBucketSchema(definition: ResourceDefinition, objects: Map<string, Resource<unknown>>, resource: Resource<any>) {
  const {spec, metadata} = resource;
  for (const propertyName in spec.properties) {
    const property = spec.properties[propertyName];
    if ( property.type == "relation" && typeof property.bucket == 'object' ) {
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

  console.log('end');
}

function getResourceDefinitionAndVersionAndKey(definitions: ResourceDefinition[],  group: string, versionName: string, resourceName: string) {
  console.log(group, versionName, resourceName);
  const definition = definitions.find(def => doesTheNameMatchDefinition(resourceName, def));
  const key = `${definition.group}/${definition.names.plural}`;
  return {
    definition,
    key
  }
}


@Catch()
export class StatusFilter implements ExceptionFilter {
  catch(exceptionOrStatus: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<any>();
    if ( !isStatusKind(exceptionOrStatus) ) {
      exceptionOrStatus = status({
        code: 500,
        message: exceptionOrStatus['message'] ? exceptionOrStatus['message'] : "unknown error",
        status: 'Failure',
        reason: "InternalError"
      }) 
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
  definitions() {
    return definitions;
  }

  @Get(":group/:version/:resource")
  list(
    @Param("group") group: string,
    @Param("version") versionName: string,
    @Param("resource") resourceName: string
  ) {
    const {key} = getResourceDefinitionAndVersionAndKey(definitions, group, versionName, resourceName);

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
    const {key} = getResourceDefinitionAndVersionAndKey(definitions, group, versionName, resourceName);

    const objects = this.store.has(key) ? this.store.get(key) : new Map();

    return objects.get(objectName);
  }

  @Post(":group/:version/:resource")
  async add(
    @Param("group") group: string,
    @Param("version") versionName: string,
    @Param("resource") resourceName: string,
    @Body() object: Resource
  ) {
    const {key, definition} = getResourceDefinitionAndVersionAndKey(definitions, group, versionName, resourceName);

    const objects = this.store.has(key) ? this.store.get(key) : this.store.set(key, new Map<string, Resource<unknown>>()).get(key);

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
    const {key, definition} = getResourceDefinitionAndVersionAndKey(definitions, group, versionName, resourceName);

    const objects = this.store.has(key) ? this.store.get(key) : this.store.set(key, new Map<string, Resource<unknown>>()).get(key);

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
    const {key, definition} = getResourceDefinitionAndVersionAndKey(definitions, group, versionName, resourceName);

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
