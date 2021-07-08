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
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
  Res,
  UseGuards,
  UseInterceptors
} from "@nestjs/common";
import {activity} from "@spica-server/activity/services";
import {ARRAY, BOOLEAN, DEFAULT} from "@spica-server/core";
import {Schema} from "@spica-server/core/schema";
import {ObjectId, OBJECT_ID} from "@spica-server/database";
import {Scheduler} from "@spica-server/function/scheduler";
import {ActionGuard, AuthGuard, ResourceFilter} from "@spica-server/passport/guard";
import * as os from "os";
import {from, of, OperatorFunction} from "rxjs";
import {catchError, finalize, last, map, take, tap} from "rxjs/operators";
import {createFunctionActivity} from "./activity.resource";
import {FunctionEngine} from "./engine";
import {FunctionService} from "./function.service";
import {ChangeKind, hasContextChange} from "./change";
import {Function} from "./interface";
import {FUNCTION_OPTIONS, Options} from "./options";
import {generate} from "./schema/enqueuer.resolver";
import {changesFromTriggers, createTargetChanges} from "./change";
import {LogService} from "./log/src/log.service";

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

  @Put("integrations/:integration/repos/:repo/branches/:branch/commits/:commit")
  @UseGuards(AuthGuard(), ActionGuard("function:integrations", "function"))
  async pull(
    @Param("integration") integration: string,
    @Param("repo") repo: string,
    @Param("branch") branch: string,
    @Param("commit") commit: string = "latest",
    @Body() options: any
  ) {
    if (commit != "latest") {
      throw new BadRequestException(
        "Pulling the specific commit is still in development progress. You can use 'latest' for pulling the latest commit for now."
      );
    }

    return this.engine
      .pullCommit(integration, repo, branch, options.token)
      .then(count => {
        return {
          message: `${count} function(s) updated.`
        };
      })
      .catch(e => {
        throw new BadRequestException(e.toString());
      });
  }

  @Post("integrations/:integration/repos/:repo/branches/:branch/commits")
  @UseGuards(AuthGuard(), ActionGuard("function:integrations", "function"))
  async push(
    @Param("integration") integration: string,
    @Param("repo") repo: string,
    @Param("branch") branch: string,
    @Body() options: any
  ) {
    return this.engine.pushCommit(integration, repo, branch, options.message).catch(e => {
      throw new BadRequestException(e.toString());
    });
  }

  @Post("integrations/:integration/repos")
  @UseGuards(AuthGuard(), ActionGuard("function:integrations", "function"))
  async create(@Param("integration") integration: string, @Body() options: any) {
    return this.engine.createRepo(integration, options.repo, options.token).catch(e => {
      throw new BadRequestException(e.toString());
    });
  }

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
        options: await from(this.engine.getSchema(enqueuer.description.name))
          .pipe(take(1))
          .toPromise()
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
  index(@ResourceFilter() resourceFilter) {
    return this.fs.aggregate([resourceFilter]).toArray();
  }

  /**
   * @description Returns the function object
   * @param id Identifier of the function
   */
  @Get(":id")
  @UseGuards(AuthGuard(), ActionGuard("function:show"))
  findOne(@Param("id", OBJECT_ID) id: ObjectId) {
    return this.fs.findOne({_id: id});
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
    const fn = await this.fs.findOneAndDelete({_id: id}, {});
    if (!fn) {
      throw new NotFoundException("Couldn't find the function.");
    }

    this.log.deleteMany({function: id.toString()});

    const changes = createTargetChanges(fn, ChangeKind.Removed);
    this.engine.categorizeChanges(changes);

    await this.engine.deleteFunction(fn);
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
    fn._id = id;
    delete fn._id;
    // Language is immutable
    delete fn.language;
    const previousFn = await this.fs.findOneAndUpdate({_id: id}, {$set: fn});

    fn._id = id;

    let changes;

    if (hasContextChange(previousFn, fn)) {
      // mark all triggers updated
      changes = createTargetChanges(fn, ChangeKind.Updated);
    } else {
      changes = changesFromTriggers(previousFn, fn);
    }

    this.engine.categorizeChanges(changes);

    return fn;
  }

  /**
   * @description Adds the function object present in the body and returns the inserted function object.
   * @param id Identifier of the function
   */
  @UseInterceptors(activity(createFunctionActivity))
  @Post()
  @UseGuards(AuthGuard(), ActionGuard("function:create"))
  async insertOne(@Body(Schema.validate(generate)) fn: Function) {
    fn = await this.fs.insertOne(fn).catch(error => {
      throw new HttpException(error.message, error.status || 500);
    });

    const changes = createTargetChanges(fn, ChangeKind.Added);
    this.engine.categorizeChanges(changes);

    await this.engine.createFunction(fn);
    return fn;
  }

  /**
   * @description Replaces index(code) of the function with the index in the body. <br>
   * Also, it compiles the index to make it ready for execution.
   * @param id Identifier of the function
   */
  @Post(":id/index")
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthGuard(), ActionGuard("function:update", "function/:id"))
  async updateIndex(@Param("id", OBJECT_ID) id: ObjectId, @Body("index") index: string) {
    const fn = await this.fs.findOne({_id: id});
    if (!fn) {
      throw new NotFoundException("Cannot find function.");
    }
    await this.engine.update(fn, index);
    return this.engine
      .compile(fn)
      .catch(diagnostics => Promise.reject(new HttpException(diagnostics, 422)));
  }

  /**
   * @description Returns index(code) of the function
   * @param id Identifier of the function
   */
  @Get(":id/index")
  @UseGuards(AuthGuard(), ActionGuard("function:show", "function/:id"))
  async showIndex(@Param("id", OBJECT_ID) id: ObjectId) {
    const fn = await this.fs.findOne({_id: id});
    if (!fn) {
      throw new NotFoundException("Can not find function.");
    }
    const index = await this.engine.read(fn);
    return {index};
  }

  /**
   * @description Returns of dependencies of the function with their versions.
   * @param id Identifier of the function
   */
  @Get(":id/dependencies")
  @UseGuards(AuthGuard(), ActionGuard("function:show", "function/:id"))
  async getDependencies(@Param("id", OBJECT_ID) id: ObjectId) {
    const fn = await this.fs.findOne({_id: id});
    if (!fn) {
      throw new NotFoundException("Could not find the function.");
    }
    return this.engine.getPackages(fn);
  }

  /**
   * @description Adds one or more dependency to the function
   * @param progress When true, installation progress is reported.
   * @param id Identifier of the function
   */
  @Post(":id/dependencies")
  @UseGuards(AuthGuard(), ActionGuard("function:update", "function/:id"))
  @Header("X-Content-Type-Options", "nosniff")
  async addDependency(
    @Param("id", OBJECT_ID) id: ObjectId,
    @Body("name", DEFAULT([]), ARRAY(String)) name: string[],
    @Res() res,
    @Query("progress", BOOLEAN) progress?: boolean
  ) {
    if (!name) {
      throw new BadRequestException("Dependency name is required.");
    }
    const fn = await this.fs.findOne({_id: id});
    if (!fn) {
      throw new NotFoundException("Could not find the function.");
    }

    let operators: OperatorFunction<unknown, unknown>[] = [
      catchError(err => {
        res.status(400).send({message: err.toString()});
        return err;
      })
    ];

    if (progress) {
      operators = [];
      operators.push(
        map(progress => {
          return {
            progress,
            state: "installing"
          };
        }),
        catchError(error =>
          of({
            state: "failed",
            message: error
          })
        ),
        tap(response => res.write(`${JSON.stringify(response)}${os.EOL}`))
      );
    }
    operators.push(last(), finalize(() => res.end()));

    return (this.engine.addPackage(fn, name) as any).pipe(...operators);
  }

  /**
   * @description Removes a dependency from the function
   * @param id Identifier of the function
   * @param name Name of the dependency to remove
   */
  @Delete(":id/dependencies/:name(*)")
  @UseGuards(AuthGuard(), ActionGuard("function:update", "function/:id"))
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteDependency(@Param("id", OBJECT_ID) id: ObjectId, @Param("name") name: string) {
    const fn = await this.fs.findOne({_id: id});
    if (!fn) {
      throw new NotFoundException("Could not find the function.");
    }
    return this.engine.removePackage(fn, name).catch(error => {
      throw new BadRequestException(error.message);
    });
  }
}
