import {
  ArgumentsHost,
  Body,
  Catch,
  Controller,
  Delete,
  ExceptionFilter,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseFilters,
  UseGuards,
  UseInterceptors
} from "@nestjs/common";
import {DatabaseService} from "@spica-server/database";
import {AuthGuard, ActionGuard} from "@spica-server/passport/guard";
import {Resource} from "./definition";
import {inform} from "./informer";
import {PatchBodyParser} from "./patch";
import {
  findSchemeByGroup,
  findSchemeByGroupAndVersionAndResource,
  findSchemesByGroupAndVersion,
  getVersionFromScheme,
  GroupVersionResource,
  schemes
} from "./scheme";
import {alreadyExists, badRequest, isStatusKind, notFound, status, StatusMetadata} from "./status";
import {store, __setDb} from "./store";
import {acceptsTable, table} from "./table";
import {validate} from "./validation";

const DEBUG = true;

@Catch()
export class StatusFilter implements ExceptionFilter {
  isAuthException(exception) {
    const authExceptionCodes = [401, 403];
    return authExceptionCodes.includes(exception.status);
  }
  catch(exceptionOrStatus: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<any>();

    if (!isStatusKind(exceptionOrStatus)) {
      let metadata: StatusMetadata;

      if (exceptionOrStatus["message"] && DEBUG) {
        metadata = {stack: exceptionOrStatus["stack"]};
      }

      const isAuthException = this.isAuthException(exceptionOrStatus);
      if (isAuthException) {
        exceptionOrStatus = status({
          code: exceptionOrStatus["status"],
          message: exceptionOrStatus["response"]["message"],
          status: "Failure",
          reason: exceptionOrStatus["response"]["error"]
        });
      } else {
        exceptionOrStatus = status({
          code: 500,
          message: exceptionOrStatus["message"] ? exceptionOrStatus["message"] : "unknown error",
          status: "Failure",
          reason: "InternalError",
          metadata
        });
      }
    }

    if (isStatusKind(exceptionOrStatus)) {
      response.status(exceptionOrStatus.code).json(exceptionOrStatus);
    }
  }
}

@UseFilters(new StatusFilter())
@Controller("apis-info")
export class ApiMachineryController {
  // healthz
  // version
  // metrics

  constructor(db: DatabaseService) {
    __setDb(db);
  }

  @Get()
  apiGroups() {
    const groupMap = new Map<string, {name: string; versions: Set<string>}>();

    for (const scheme of schemes()) {
      const groupName = scheme.definition.group;
      if (!groupMap.has(groupName)) {
        groupMap.set(groupName, {
          name: groupName,
          versions: new Set()
        });
      }
      const group = groupMap.get(groupName);

      for (const version of scheme.definition.versions) {
        group.versions.add(version.name);
      }
    }

    const groups = [];

    for (const group of groupMap.values()) {
      groups.push({
        name: group.name,
        versions: Array.from(group.versions)
      });
    }

    return {
      kind: "APIGroupList",
      apiVersion: "v1",
      groups: groups
    };
  }

  @Get(":group")
  apiGroup(@Param("group") groupName: string) {
    const scheme = findSchemeByGroup(groupName);

    if (!scheme) {
      return notFound({
        message: "the server could not find the requested resource"
      });
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
    const schemes = findSchemesByGroupAndVersion({
      group: groupName,
      version: versionName
    });

    if (!schemes.length) {
      return notFound({
        message: "the server could not find the requested resource"
      });
    }

    const resources = [];

    for (const scheme of schemes) {
      resources.push(scheme.definition.names);
    }

    return {
      kind: "APIResourceList",
      apiVersion: "v1",
      version: versionName,
      resources
    };
  }
}

@UseFilters(new StatusFilter())
@Controller("apis")
export class ApiMachineryObjectController {
  @Get()
  @UseGuards(AuthGuard(), ActionGuard("apis:index", "apis"))
  async listPackages(@Query("package") packageName: string) {
    const filter = {"metadata.uid": {$exists: true}};
    if (packageName) {
      filter["metadata.package"] = packageName;
    }
    return store().find(filter);
  }

  @Delete()
  @UseGuards(AuthGuard(), ActionGuard("apis:index", "apis"))
  async listByPackage(@Query("package") packageName: string) {
    if (!packageName) {
      throw badRequest({
        reason: "BadRequest",
        message: "Query 'package' was not provided.",
        details: []
      });
    }

    return store().deleteByFilter({"metadata.package": packageName});
  }

  @Get("/:group/:version/:resource")
  @UseGuards(AuthGuard(), ActionGuard("apis:index", "apis"))
  async list(
    @Headers("accept") accepts: string,
    @Param("group") groupName: string,
    @Param("version") versionName: string,
    @Param("resource") resourceName: string
  ) {
    const groupVersionResource: GroupVersionResource = {
      group: groupName,
      version: versionName,
      resource: resourceName
    };

    const scheme = findSchemeByGroupAndVersionAndResource(groupVersionResource);

    if (!scheme) {
      return notFound({
        message: "the server could not find the requested resource"
      });
    }
    const objectStore = store(groupVersionResource);
    const objects = await objectStore.values();

    if (acceptsTable(accepts)) {
      return table(objects, getVersionFromScheme(scheme, versionName));
    }

    return Array.from(objects);
  }

  @Get("/:group/:version/:resource/:name")
  @UseGuards(AuthGuard(), ActionGuard("apis:index", "apis"))
  get(
    @Param("group") groupName: string,
    @Param("version") versionName: string,
    @Param("resource") resourceName: string,
    @Param("name") objectName: string
  ) {
    const groupVersionResource: GroupVersionResource = {
      group: groupName,
      version: versionName,
      resource: resourceName
    };

    const scheme = findSchemeByGroupAndVersionAndResource(groupVersionResource);

    if (!scheme) {
      return notFound({
        message: "the server could not find the requested resource"
      });
    }

    const objects = store(groupVersionResource);

    return objects.get(objectName);
  }

  @Post("/:group/:version/:resource")
  @UseGuards(AuthGuard(), ActionGuard("apis:create", "apis"))
  async add(
    @Param("group") groupName: string,
    @Param("version") versionName: string,
    @Param("resource") resourceName: string,
    @Body() object: Resource<object>
  ) {
    const groupVersionResource: GroupVersionResource = {
      group: groupName,
      version: versionName,
      resource: resourceName
    };

    const scheme = findSchemeByGroupAndVersionAndResource(groupVersionResource);

    if (!scheme) {
      return notFound({
        message: "the server could not find the requested resource"
      });
    }

    const objects = store(groupVersionResource);

    const objectName = object.metadata.name;

    if (await objects.has(objectName)) {
      throw alreadyExists({
        message: `${scheme.definition.names.singular} "${objectName}" already exists.`,
        details: {
          kind: scheme.definition.names.kind,
          name: objectName
        }
      });
    }

    if (!object.metadata.creationTimestamp) {
      object.metadata.creationTimestamp = new Date().toISOString();
    }

    await validate({scheme, versionName, object});

    if (scheme.prepareForCreate) {
      scheme.prepareForCreate(object);
    }

    await objects.set(objectName, object);

    inform({type: "add", obj: object, groupResource: groupVersionResource});
  }

  @Put("/:group/:version/:resource/:name")
  @UseGuards(AuthGuard(), ActionGuard("apis:update", "apis"))
  async replace(
    @Param("group") groupName: string,
    @Param("version") versionName: string,
    @Param("resource") resourceName: string,
    @Param("name") objectName: string,
    @Body() object: Resource<object>
  ) {
    const groupVersionResource: GroupVersionResource = {
      group: groupName,
      version: versionName,
      resource: resourceName
    };

    const scheme = findSchemeByGroupAndVersionAndResource(groupVersionResource);

    if (!scheme) {
      return notFound({
        message: "the server could not find the requested resource"
      });
    }

    const objects = store(groupVersionResource);

    if (!(await objects.has(objectName))) {
      throw notFound({
        message: `${scheme.definition.names.singular} "${objectName}" could not be found.`,
        details: {
          kind: scheme.definition.names.kind,
          name: objectName
        }
      });
    }

    const oldObj = await objects.get(objectName);

    const newObj = {...oldObj, spec: object.spec};

    await validate({scheme, versionName, object});

    if (scheme.prepareForUpdate) {
      scheme.prepareForUpdate(newObj);
    }

    await objects.set(objectName, newObj);

    inform({type: "update", oldObj, newObj, groupResource: groupVersionResource});
  }

  @Delete("/:group/:version/:resource/:name")
  @UseGuards(AuthGuard(), ActionGuard("apis:delete", "apis"))
  async delete(
    @Param("group") groupName: string,
    @Param("version") versionName: string,
    @Param("resource") resourceName: string,
    @Param("name") objectName: string
  ) {
    const groupVersionResource: GroupVersionResource = {
      group: groupName,
      version: versionName,
      resource: resourceName
    };

    const scheme = findSchemeByGroupAndVersionAndResource(groupVersionResource);

    if (!scheme) {
      return notFound({
        message: "the server could not find the requested resource"
      });
    }

    const objects = store(groupVersionResource);

    if (!(await objects.has(objectName))) {
      throw notFound({
        message: `${scheme.definition.names.singular} "${objectName}" could not be found.`,
        details: {
          kind: scheme.definition.names.kind,
          name: objectName
        }
      });
    }

    await objects.patch(objectName, {metadata: {deletionTimestamp: new Date().toISOString()}});

    const obj = await objects.get(objectName);

    await objects.delete(objectName);

    inform({type: "delete", obj, groupResource: groupVersionResource});
  }

  @UseInterceptors(PatchBodyParser())
  @Patch("/:group/:version/:resource/:name")
  patch(
    @Param("group") group: string,
    @Param("version") versionName: string,
    @Param("resource") resourceName: string,
    @Param("name") objectName: string,
    @Body() object: Resource
  ) {}
}
