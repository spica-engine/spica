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
import {ActionGuard, AuthGuard} from "@spica-server/passport";
import * as os from "os";
import {from, of, OperatorFunction} from "rxjs";
import {catchError, finalize, last, map, take, tap} from "rxjs/operators";
import {createFunctionActivity} from "./activity.resource";
import {FunctionEngine} from "./engine";
import {FunctionService} from "./function.service";
import {Function, Trigger} from "./interface";
import {FUNCTION_OPTIONS, Options} from "./options";
import {generate} from "./schema/enqueuer.resolver";

@Controller("function")
export class FunctionController {
  constructor(
    private fs: FunctionService,
    private engine: FunctionEngine,
    private scheduler: Scheduler,
    @Inject(FUNCTION_OPTIONS) private options: Options
  ) {}

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
    for (const runtime of this.scheduler.runtimes) {
      runtimes.push(runtime.description);
    }

    return {enqueuers, runtimes, timeout: this.options.timeout};
  }

  @Get()
  @UseGuards(AuthGuard(), ActionGuard("function:index"))
  index() {
    return this.fs.find();
  }

  @Get(":id")
  @UseGuards(AuthGuard(), ActionGuard("function:show"))
  findOne(@Param("id", OBJECT_ID) id: ObjectId) {
    return this.fs.findOne({_id: id});
  }

  @UseInterceptors(activity(createFunctionActivity))
  @Delete(":id")
  @UseGuards(AuthGuard(), ActionGuard("function:delete"))
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteOne(@Param("id", OBJECT_ID) id: ObjectId) {
    const fn = await this.fs.findOneAndDelete({_id: id}, {});
    if (!fn) {
      throw new NotFoundException("Couldn't find the function.");
    }
    await this.engine.deleteFunction(fn);
  }

  private async hasDuplicatedBucketHandlers(fn: Function): Promise<boolean> {
    const functions = (await this.fs.find({_id: {$ne: fn._id}})).concat(fn);
    const triggers = functions.reduce((acc, fn) => {
      for (const handler in fn.triggers) {
        if (fn.triggers.hasOwnProperty(handler)) {
          const trigger = fn.triggers[handler];
          acc.push(trigger);
        }
      }
      return acc;
    }, new Array<Trigger>());

    return triggers
      .filter(trigger => trigger.type == "bucket")
      .some((trigger, index, triggers) => {
        const foundIndex = triggers.findIndex(
          t =>
            t.options["bucket"] == trigger.options["bucket"] &&
            t.options["type"] == trigger.options["type"]
        );
        return foundIndex != index;
      });
  }

  @UseInterceptors(activity(createFunctionActivity))
  @Put(":id")
  @UseGuards(AuthGuard(), ActionGuard("function:update"))
  async replaceOne(
    @Param("id", OBJECT_ID) id: ObjectId,
    @Body(Schema.validate(generate)) fn: Function
  ) {
    fn._id = id;
    const hasDuplicatedHandlers = await this.hasDuplicatedBucketHandlers(fn);
    if (hasDuplicatedHandlers) {
      throw new BadRequestException(
        "Multiple handlers on same bucket and event type are not supported."
      );
    }
    delete fn._id;
    return this.fs.findOneAndUpdate({_id: id}, {$set: fn}, {returnOriginal: false});
  }

  @UseInterceptors(activity(createFunctionActivity))
  @Post()
  @UseGuards(AuthGuard(), ActionGuard("function:create"))
  async insertOne(@Body(Schema.validate(generate)) fn: Function) {
    const hasDuplicatedHandlers = await this.hasDuplicatedBucketHandlers(fn);
    if (hasDuplicatedHandlers) {
      throw new BadRequestException(
        "Multiple handlers on same bucket and event type are not supported."
      );
    }
    fn = await this.fs.insertOne(fn);
    await this.engine.createFunction(fn);
    return fn;
  }

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

  @Get(":id/dependencies")
  @UseGuards(AuthGuard(), ActionGuard("function:show", "function/:id"))
  async getDependencies(@Param("id", OBJECT_ID) id: ObjectId) {
    const fn = await this.fs.findOne({_id: id});
    if (!fn) {
      throw new NotFoundException("Could not find the function.");
    }
    return this.engine.getPackages(fn);
  }

  @Post(":id/dependencies")
  @UseGuards(AuthGuard(), ActionGuard("function:update", "function/:id"))
  @Header("X-Content-Type-Options", "nosniff")
  async addDependency(
    @Param("id", OBJECT_ID) id: ObjectId,
    @Query("progress", BOOLEAN) progress: boolean,
    @Body("name", DEFAULT([]), ARRAY(String)) name: string[],
    @Res() res
  ) {
    if (!name) {
      throw new BadRequestException("Dependency name is required.");
    }
    const fn = await this.fs.findOne({_id: id});
    if (!fn) {
      throw new NotFoundException("Could not find the function.");
    }

    const operators: OperatorFunction<unknown, unknown>[] = [];

    if (progress) {
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
    operators.push(
      last(),
      tap(() => {
        this.engine.compile(fn).catch(() => {});
      }),
      finalize(() => res.end())
    );

    return (this.engine.addPackage(fn, name) as any).pipe(...operators);
  }

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
