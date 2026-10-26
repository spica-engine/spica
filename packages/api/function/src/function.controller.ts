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
import {activity} from "@spica-server/activity-services";
import {ARRAY, BOOLEAN, DEFAULT, JSONP} from "@spica-server/core";
import {Schema} from "@spica-server/core-schema";
import {ID} from "@spica-server/data";
import {COLLECTION_QUERY, CollectionQueryFacade, Id} from "@spica-server/interface-data";
import {Scheduler} from "@spica-server/function-scheduler";
import {ActionGuard, AuthGuard, ResourceFilter} from "@spica-server/passport-guard";
import os from "os";
import {of, OperatorFunction} from "rxjs";
import {catchError, finalize, last, map, tap} from "rxjs/operators";
import {
  createFunctionActivity,
  createFunctionIndexActivity,
  createFunctionDependencyActivity,
  createFunctionEnvVarActivity,
  createFunctionSecretActivity
} from "./activity.resource.js";
import {FunctionEngine} from "./engine.js";
import {SecretService} from "@spica-server/secret-services";
import {
  Options,
  FUNCTION_OPTIONS,
  FUNCTION_REPOSITORY,
  EnvRelation,
  Function,
  FunctionRepository,
  SecretRelation
} from "@spica-server/interface-function";
import {FUNCTION_LOG_REPOSITORY, LogRepository} from "@spica-server/interface-function-log";
import {generate} from "./schema/enqueuer.resolver.js";
import {applyPatch} from "@spica-server/core-patch";
import * as CRUD from "./crud.js";

const FUNCTION_COLLECTION = "function";
const ENV_VAR_COLLECTION = "env_var";
const SECRET_COLLECTION = "secret";

/**
 * @name Function
 * @description These APIs are responsible for all function operations.
 */
@Controller("function")
export class FunctionController {
  constructor(
    @Inject(FUNCTION_REPOSITORY) private functions: FunctionRepository,
    private engine: FunctionEngine,
    private scheduler: Scheduler,
    @Inject(FUNCTION_LOG_REPOSITORY) private logs: LogRepository,
    private ss: SecretService,
    @Inject(FUNCTION_OPTIONS) private options: Options,
    @Inject(COLLECTION_QUERY) private queries: CollectionQueryFacade
  ) {}

  /**
   * @description Returns all available enqueuers, runtimes, and the timeout information.
   * @param id Identifier of the function
   */
  @Get("information")
  @UseGuards(AuthGuard(["IDENTITY", "APIKEY"]))
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
  @UseGuards(AuthGuard(["IDENTITY", "APIKEY"]), ActionGuard("function:index"))
  index(
    @ResourceFilter({collection: FUNCTION_COLLECTION}) resourceFilter,
    @Query("filter", DEFAULT({}), JSONP) filter: {index?: string}
  ) {
    return CRUD.find(this.queries, this.engine, {
      filter: {
        resources: resourceFilter,
        index: filter.index
      },
      resolveEnvRelations: EnvRelation.Resolved,
      resolveSecretRelations: SecretRelation.Resolved
    }).catch(e => {
      throw new BadRequestException(e);
    });
  }

  /**
   * @description Returns the function object
   * @param id Identifier of the function
   */
  @Get(":id")
  @UseGuards(AuthGuard(["IDENTITY", "APIKEY"]), ActionGuard("function:show"))
  findOne(@Param("id", ID(FUNCTION_COLLECTION)) id: Id) {
    return CRUD.findOne(this.queries, id, {
      resolveEnvRelations: EnvRelation.Resolved,
      resolveSecretRelations: SecretRelation.Resolved
    }).catch(error => {
      throw new HttpException(error.message, error.status || 500);
    });
  }

  /**
   * @description Removes the function object along with its index and dependencies.
   * @param id Identifier of the function
   */
  @UseInterceptors(activity(createFunctionActivity))
  @Delete(":id")
  @UseGuards(AuthGuard(["IDENTITY", "APIKEY"]), ActionGuard("function:delete"))
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteOne(@Param("id", ID(FUNCTION_COLLECTION)) id: Id) {
    return CRUD.remove(this.functions, this.engine, this.logs, id);
  }

  /**
   * @description Replaces a function object and returns the latest committed version of function object.<br>
   * Keep in mind that `language` is immutable and ignored silently if present
   * @param id Identifier of the function
   */
  @UseInterceptors(activity(createFunctionActivity))
  @Put(":id")
  @UseGuards(AuthGuard(["IDENTITY", "APIKEY"]), ActionGuard("function:update"))
  async replaceOne(
    @Param("id", ID(FUNCTION_COLLECTION)) id: Id,
    @Body(Schema.validate(generate)) fn: Function
  ) {
    return CRUD.replace(this.functions, this.engine, {...fn, _id: id}).catch(error => {
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
  @UseGuards(AuthGuard(["IDENTITY", "APIKEY"]), ActionGuard("function:update"))
  async updateOne(
    @Param("id", ID(FUNCTION_COLLECTION)) id: Id,
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

    const previousFn = await this.functions.findById(id);
    if (!previousFn) {
      throw new NotFoundException(`Function with id ${id} does not exist.`);
    }

    const patchedFn = applyPatch(previousFn, patch);
    delete patchedFn._id;

    const updatedFn = await this.functions.applyMergePatch(id, patch, patchedFn);

    return updatedFn === undefined ? previousFn : updatedFn;
  }

  /**
   * @description Adds the function object present in the body and returns the inserted function object.
   * @param id Identifier of the function
   */
  @UseInterceptors(activity(createFunctionActivity))
  @Post()
  @UseGuards(AuthGuard(["IDENTITY", "APIKEY"]), ActionGuard("function:create"))
  async insertOne(@Body(Schema.validate(generate)) fn: Function) {
    return CRUD.insert(this.functions, this.engine, fn).catch(error => {
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
  @UseGuards(AuthGuard(["IDENTITY", "APIKEY"]), ActionGuard("function:update", "function/:id"))
  async updateIndex(@Param("id", ID(FUNCTION_COLLECTION)) id: Id, @Body("index") index: string) {
    return CRUD.index
      .write(this.functions, this.engine, id, index)
      .catch(diagnostics => Promise.reject(new HttpException(diagnostics, 422)));
  }

  /**
   * @description Returns index(code) of the function
   * @param id Identifier of the function
   */
  @Get(":id/index")
  @UseGuards(AuthGuard(["IDENTITY", "APIKEY"]), ActionGuard("function:show", "function/:id"))
  async showIndex(@Param("id", ID(FUNCTION_COLLECTION)) id: Id) {
    return CRUD.index.find(this.functions, this.engine, id).catch(error => {
      throw new HttpException(error.message, error.status || 500);
    });
  }

  /**
   * @description Returns of dependencies of the function with their versions.
   * @param id Identifier of the function
   */
  @Get(":id/dependencies")
  @UseGuards(AuthGuard(["IDENTITY", "APIKEY"]), ActionGuard("function:show", "function/:id"))
  async getDependencies(@Param("id", ID(FUNCTION_COLLECTION)) id: Id) {
    return CRUD.dependencies.findOne(this.functions, this.engine, id).catch(error => {
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
  @UseGuards(AuthGuard(["IDENTITY", "APIKEY"]), ActionGuard("function:update", "function/:id"))
  @Header("X-Content-Type-Options", "nosniff")
  async addDependency(
    @Param("id", ID(FUNCTION_COLLECTION)) id: Id,
    @Body("name", DEFAULT([]), ARRAY(String)) name: string[]
  ) {
    const fn = await this.functions.findById(id);

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
  @UseGuards(AuthGuard(["IDENTITY", "APIKEY"]), ActionGuard("function:update", "function/:id"))
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteDependency(
    @Param("id", ID(FUNCTION_COLLECTION)) id: Id,
    @Param("name") name: string
  ) {
    const fn = await this.functions.findById(id);

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
  @UseGuards(AuthGuard(["IDENTITY", "APIKEY"]), ActionGuard("function:env-var:inject"))
  async injectEnvironmentVariable(
    @Param("id", ID(FUNCTION_COLLECTION)) id: Id,
    @Param("envVarId", ID(ENV_VAR_COLLECTION)) envVarId: Id
  ) {
    return CRUD.environment.inject(this.functions, id, this.engine, envVarId);
  }

  /**
   * Eject the environment variable from function.
   * @param id identifier of the function.
   * @param envVarId identifier of the environment variable. Example: `5f31002e4a51a68d6fec4d3f`
   */
  @UseInterceptors(activity(createFunctionEnvVarActivity))
  @Delete(":id/env-var/:envVarId")
  @UseGuards(AuthGuard(["IDENTITY", "APIKEY"]), ActionGuard("function:env-var:eject"))
  @HttpCode(HttpStatus.NO_CONTENT)
  async ejectEnvironmentVariable(
    @Param("id", ID(FUNCTION_COLLECTION)) id: Id,
    @Param("envVarId", ID(ENV_VAR_COLLECTION)) envVarId: Id
  ) {
    return CRUD.environment.eject(this.functions, id, this.engine, envVarId);
  }

  /**
   * Inject the secret to function.
   * @param id identifier of the function.
   * @param secretId identifier of the secret.
   */
  @UseInterceptors(activity(createFunctionSecretActivity))
  @Put(":id/secret/:secretId")
  @UseGuards(AuthGuard(["IDENTITY", "APIKEY"]), ActionGuard("function:secret:inject"))
  async injectSecret(
    @Param("id", ID(FUNCTION_COLLECTION)) id: Id,
    @Param("secretId", ID(SECRET_COLLECTION)) secretId: Id
  ) {
    return CRUD.secret.inject(this.functions, this.ss, id, this.engine, secretId);
  }

  /**
   * Eject the secret from function.
   * @param id identifier of the function.
   * @param secretId identifier of the secret.
   */
  @UseInterceptors(activity(createFunctionSecretActivity))
  @Delete(":id/secret/:secretId")
  @UseGuards(AuthGuard(["IDENTITY", "APIKEY"]), ActionGuard("function:secret:eject"))
  @HttpCode(HttpStatus.NO_CONTENT)
  async ejectSecret(
    @Param("id", ID(FUNCTION_COLLECTION)) id: Id,
    @Param("secretId", ID(SECRET_COLLECTION)) secretId: Id
  ) {
    return CRUD.secret.eject(this.functions, this.ss, id, this.engine, secretId);
  }
}
