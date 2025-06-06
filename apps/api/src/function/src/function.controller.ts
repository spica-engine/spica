import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpException,
  HttpStatus,
  Inject,
  InternalServerErrorException,
  NotFoundException,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Res,
  UseGuards,
  UseInterceptors,
  Headers
} from "@nestjs/common";
import {activity} from "@spica-server/activity/services";
import {ARRAY, BOOLEAN, DEFAULT, JSONP} from "@spica-server/core";
import {Schema} from "@spica-server/core/schema";
import {ObjectId, OBJECT_ID, ReturnDocument} from "@spica-server/database";
import {Scheduler} from "@spica-server/function/scheduler";
import {ActionGuard, AuthGuard, ResourceFilter} from "@spica-server/passport/guard";
import os from "os";
import {of, OperatorFunction} from "rxjs";
import {catchError, finalize, last, map, tap} from "rxjs/operators";
import {
  createFunctionActivity,
  createFunctionIndexActivity,
  createFunctionDependencyActivity,
  createFunctionEnvVarActivity
} from "./activity.resource";
import {FunctionEngine} from "./engine";
import {FunctionService} from "@spica-server/function/services";
import {Options, FUNCTION_OPTIONS, EnvRelation, Function} from "@spica-server/interface/function";
import {LogService} from "@spica-server/function/log/src/log.service";
import {generate} from "./schema/enqueuer.resolver";
import {applyPatch} from "@spica-server/core/patch";
import * as CRUD from "./crud";

/**
 * @name Function
 * @description These APIs are responsible for all function operations.
 */
@Controller("function")
export class FunctionController {
  constructor(
    private fs: FunctionService,
    private engine: FunctionEngine,
    private scheduler: Scheduler,
    private log: LogService,
    @Inject(FUNCTION_OPTIONS) private options: Options
  ) {}

  /**
   * @description Returns all available enqueuers, runtimes, and the timeout information.
   * @param id Identifier of the function
   */
  @Get("information")
  @UseGuards(AuthGuard())
  async information() {
    const enqueuers = [];

    for (const enqueuer of this.scheduler.enqueuers) {
      enqueuers.push({
        description: enqueuer.description,
        options: await this.engine.getSchema(enqueuer.description.name)
      });
    }

    const runtimes = [];
    for (const [_, runtime] of this.scheduler.runtimes) {
      runtimes.push(runtime.description);
    }

    return {enqueuers, runtimes, timeout: this.options.timeout};
  }

  /**
   * @description Returns all available function objects.
   * @param id Identifier of the function
   */
  @Get()
  @UseGuards(AuthGuard(), ActionGuard("function:index"))
  index(
    @ResourceFilter() resourceFilter,
    @Query("filter", DEFAULT({}), JSONP) filter: {index?: string}
  ) {
    return CRUD.find(this.fs, this.engine, {
      filter: {
        resources: resourceFilter,
        index: filter.index
      },
      resolveEnvRelations: EnvRelation.Resolved
    }).catch(e => {
      throw new BadRequestException(e);
    });
  }

  /**
   * @description Returns the function object
   * @param id Identifier of the function
   */
  @Get(":id")
  @UseGuards(AuthGuard(), ActionGuard("function:show"))
  findOne(@Param("id", OBJECT_ID) id: ObjectId) {
    return CRUD.findOne(this.fs, id, {
      resolveEnvRelations: EnvRelation.Resolved
    });
  }

  /**
   * @description Removes the function object along with its index and dependencies.
   * @param id Identifier of the function
   */
  @UseInterceptors(activity(createFunctionActivity))
  @Delete(":id")
  @UseGuards(AuthGuard(), ActionGuard("function:delete"))
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteOne(@Param("id", OBJECT_ID) id: ObjectId) {
    return CRUD.remove(this.fs, this.engine, this.log, id);
  }

  /**
   * @description Replaces a function object and returns the latest committed version of function object.<br>
   * Keep in mind that `language` is immutable and ignored silently if present
   * @param id Identifier of the function
   */
  @UseInterceptors(activity(createFunctionActivity))
  @Put(":id")
  @UseGuards(AuthGuard(), ActionGuard("function:update"))
  async replaceOne(
    @Param("id", OBJECT_ID) id: ObjectId,
    @Body(Schema.validate(generate)) fn: Function
  ) {
    return CRUD.replace(this.fs, this.engine, {...fn, _id: id}).catch(error => {
      throw new HttpException(error.message, error.status || 500);
    });
  }

  /**
   * Updates the schema partially. The provided body has to be a `json merge patch`.
   * See: https://tools.ietf.org/html/rfc7386
   * @param id Identifier of the schema.
   * @accepts application/merge-patch+json
   * @body ```json
   * {
   *    "name": "Update only the name but keep the rest as is."
   * }
   * ```
   */
  @UseInterceptors()
  @Patch(":id")
  @UseGuards(AuthGuard(), ActionGuard("function:update"))
  async updateOne(
    @Param("id", OBJECT_ID) id: ObjectId,
    @Headers("content-type") contentType: string,
    @Body(
      Schema.validate({
        type: "object",
        properties: {
          category: {
            type: ["string", "null"]
          },
          order: {
            type: ["number", "null"]
          }
        },
        additionalProperties: false
      })
    )
    patch: object
  ) {
    if (contentType != "application/merge-patch+json") {
      throw new BadRequestException(`Content type '${contentType}' is not supported.`);
    }

    const previousFn = await this.fs.findOne({_id: id});
    if (!previousFn) {
      throw new NotFoundException(`Function with id ${id} does not exist.`);
    }

    const patchedFn = applyPatch(previousFn, patch);
    delete patchedFn._id;

    return this.fs.findOneAndReplace({_id: id}, patchedFn, {returnDocument: ReturnDocument.AFTER});
  }

  /**
   * @description Adds the function object present in the body and returns the inserted function object.
   * @param id Identifier of the function
   */
  @UseInterceptors(activity(createFunctionActivity))
  @Post()
  @UseGuards(AuthGuard(), ActionGuard("function:create"))
  async insertOne(@Body(Schema.validate(generate)) fn: Function) {
    return CRUD.insert(this.fs, this.engine, fn).catch(error => {
      throw new HttpException(error.message, error.status || 500);
    });
  }

  /**
   * @description Replaces index(code) of the function with the index in the body. <br>
   * Also, it compiles the index to make it ready for execution.
   * @param id Identifier of the function
   */
  @UseInterceptors(activity(createFunctionIndexActivity))
  @Post(":id/index")
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthGuard(), ActionGuard("function:update", "function/:id"))
  async updateIndex(@Param("id", OBJECT_ID) id: ObjectId, @Body("index") index: string) {
    return CRUD.index
      .write(this.fs, this.engine, id, index)
      .catch(diagnostics => Promise.reject(new HttpException(diagnostics, 422)));
  }

  /**
   * @description Returns index(code) of the function
   * @param id Identifier of the function
   */
  @Get(":id/index")
  @UseGuards(AuthGuard(), ActionGuard("function:show", "function/:id"))
  async showIndex(@Param("id", OBJECT_ID) id: ObjectId) {
    return CRUD.index.find(this.fs, this.engine, id).catch(error => {
      throw new HttpException(error.message, error.status || 500);
    });
  }

  /**
   * @description Returns of dependencies of the function with their versions.
   * @param id Identifier of the function
   */
  @Get(":id/dependencies")
  @UseGuards(AuthGuard(), ActionGuard("function:show", "function/:id"))
  async getDependencies(@Param("id", OBJECT_ID) id: ObjectId) {
    return CRUD.dependencies.findOne(this.fs, this.engine, id).catch(error => {
      throw new HttpException(error.message, error.status || 500);
    });
  }

  /**
   * @description Adds one or more dependency to the function
   * @param progress When true, installation progress is reported.
   * @param id Identifier of the function
   */
  @UseInterceptors(activity(createFunctionDependencyActivity))
  @Post(":id/dependencies")
  @UseGuards(AuthGuard(), ActionGuard("function:update", "function/:id"))
  @Header("X-Content-Type-Options", "nosniff")
  async addDependency(
    @Param("id", OBJECT_ID) id: ObjectId,
    @Body("name", DEFAULT([]), ARRAY(String)) name: string[]
  ) {
    const fn = await this.fs.findOne({_id: id});

    return CRUD.dependencies.install(this.engine, fn, name).catch(error => {
      throw new HttpException(error.message, error.status || 500);
    });
  }

  /**
   * @description Removes a dependency from the function
   * @param id Identifier of the function
   * @param name Name of the dependency to remove
   */
  @UseInterceptors(activity(createFunctionDependencyActivity))
  @Delete(":id/dependencies/:name(*)")
  @UseGuards(AuthGuard(), ActionGuard("function:update", "function/:id"))
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteDependency(@Param("id", OBJECT_ID) id: ObjectId, @Param("name") name: string) {
    const fn = await this.fs.findOne({_id: id});

    return CRUD.dependencies.uninstall(this.engine, fn, [name]).catch(error => {
      throw new HttpException(error.message, error.status || 500);
    });
  }

  /**
   * Inject the environment variable to function.
   * @param id identifier of the function.
   * @param envVarId identifier of the environment variable. Example: `5f31002e4a51a68d6fec4d3f`
   */
  @UseInterceptors(activity(createFunctionEnvVarActivity))
  @Put(":id/env-var/:envVarId")
  @UseGuards(AuthGuard(), ActionGuard("function:env-var:inject"))
  async injectEnvironmentVariable(
    @Param("id", OBJECT_ID) id: ObjectId,
    @Param("envVarId", OBJECT_ID) envVarId: ObjectId
  ) {
    return CRUD.environment.inject(this.fs, id, this.engine, envVarId);
  }

  /**
   * Eject the environment variable from function.
   * @param id identifier of the function.
   * @param envVarId identifier of the environment variable. Example: `5f31002e4a51a68d6fec4d3f`
   */
  @UseInterceptors(activity(createFunctionEnvVarActivity))
  @Delete(":id/env-var/:envVarId")
  @UseGuards(AuthGuard(), ActionGuard("function:env-var:eject"))
  @HttpCode(HttpStatus.NO_CONTENT)
  async ejectEnvironmentVariable(
    @Param("id", OBJECT_ID) id: ObjectId,
    @Param("envVarId", OBJECT_ID) envVarId: ObjectId
  ) {
    return CRUD.environment.eject(this.fs, id, this.engine, envVarId);
  }
}
