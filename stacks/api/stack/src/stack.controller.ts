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
import { Resource } from "./definition";
import { PatchBodyParser } from "./patch";
import "./registry";
import { findSchemeByGroup, findSchemeByGroupAndResource, findSchemeByGroupAndVersion, makeKey, schemes } from "./scheme";
import { alreadyExists, isStatusKind, notFound, status } from "./status";

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
    const groups = [];

    for (const scheme of schemes()) {
      const versions = [];

      for (const version of scheme.definition.versions) {
        versions.push(version.name);
      }

      groups.push({
        name: scheme.definition.group,
        versions
      });
    }

    return {
      kind: "APIGroupList",
      apiVersion: "v1",
      groups
    };
  }

  @Get(":group")
  apiGroup(@Param("group") groupName: string) {
    const scheme = findSchemeByGroup(groupName);

    if ( !scheme ) {
      return notFound({
        message: 'the server could not find the requested resource'
      })
    }

    const versions = [];

    for (const version of scheme.definition.versions) {
      versions.push(version.name);
    }

    return {
      kind: "APIGroup",
      apiVersion: "v1",
      name: scheme.definition.group,
      versions
    };
  }

  @Get(":group/:version")
  apiResources(@Param("group") groupName: string, @Param("version") versionName: string) {

    const scheme = findSchemeByGroupAndVersion({
      group: groupName,
      version: versionName
    });

    if ( !scheme ) {
      return notFound({
        message: 'the server could not find the requested resource'
      })
    }
    
    const resources = [scheme.definition.names];

    return {
      kind: "APIResourceList",
      apiVersion: "v1",
      version: versionName,
      resources
    };
  }

  @Get(":group/:version/:resource")
  list(
    @Param("group") groupName: string,
    @Param("version") versionName: string,
    @Param("resource") resourceName: string
  ) {

    const scheme = findSchemeByGroupAndVersion({
      group: groupName,
      version: versionName
    });

    if ( !scheme ) {
      return notFound({
        message: 'the server could not find the requested resource'
      })
    }

    const key = makeKey({
      group: groupName,
      resource: resourceName
    });

    const objects = this.store.has(key) ? this.store.get(key) : new Map();

    return Array.from(objects.values());
  }

  @Get(":group/:version/:resource/:name")
  get(
    @Param("group") groupName: string,
    @Param("version") versionName: string,
    @Param("resource") resourceName: string,
    @Param("name") objectName: string
  ) {

    const scheme = findSchemeByGroupAndVersion({
      group: groupName,
      version: versionName
    });

    if ( !scheme ) {
      return notFound({
        message: 'the server could not find the requested resource'
      })
    }

    const key = makeKey({
      group: groupName,
      resource: resourceName
    });


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

    const key = makeKey(groupAndResource);

    const {definition, lift} = findSchemeByGroupAndResource(groupAndResource);

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

    if (!object.metadata.creationTimestamp) {
      object.metadata.creationTimestamp = new Date().toISOString();
    }

    objects.set(objectName, object);

    if ( lift ) {
      lift(this.store, object);
    }

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

    const key = makeKey(groupAndResource);

    const {definition, lift} = findSchemeByGroupAndResource(groupAndResource);

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

    const obj = objects.get(objectName);

    obj.spec = object.spec;

    objects.set(objectName, obj);

    if ( lift ) {
      lift(this.store, obj);
    }

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

    const key = makeKey(groupAndResource);

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
