import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Query,
  Res,
  UseGuards
} from "@nestjs/common";
import {DATE, DEFAULT} from "@spica-server/core";
import {Schema} from "@spica-server/core/schema";
import {ObjectId, OBJECT_ID} from "@spica-server/database";
import {ActionGuard, AuthGuard} from "@spica-server/passport";
import * as npa from "npm-package-arg";
import * as semver from "semver";
import * as stream from "stream";
import {FunctionEngine} from "./engine/engine";
import {LoggerHost} from "./engine/logger";
import {EngineRegistry} from "./engine/registry";
import {TriggerFlags} from "./engine/trigger/base";
import {FunctionService} from "./function.service";
import {Function} from "./interface";
import {generate} from "./trigger.schema.resolver";

@Controller("function")
export class FunctionController {
  constructor(
    private fs: FunctionService,
    private engine: FunctionEngine,
    private registry: EngineRegistry,
    private loggerHost: LoggerHost
  ) {}

  @Get()
  @UseGuards(AuthGuard(), ActionGuard("function:index"))
  async index() {
    const functions = await this.fs.find();
    return Promise.all(functions.map(fn => this.engine.info(fn).then(info => ({...fn, info}))));
  }

  @Post("add")
  @UseGuards(AuthGuard(), ActionGuard("function:update"))
  async add(@Body(Schema.validate(generate)) body: Function) {
    body._id = body._id || new ObjectId();

    const fn = await this.fs.upsertOne(body);
    const info = await this.engine.info(fn);
    return {...fn, info};
  }

  @Get("trigger")
  @UseGuards(AuthGuard())
  async trigger(@Query("scope") scope: string) {
    const triggers = {};
    for (const trigger of this.registry.getTriggers().filter(t => {
      if (scope && scope == "subscription") {
        return !(t.flags & TriggerFlags.NotSubscribable);
      }
      return true;
    })) {
      triggers[trigger.name] = await trigger.schema();
    }
    return triggers;
  }

  @Get(":id")
  @UseGuards(AuthGuard(), ActionGuard("function:show"))
  show(@Param("id", OBJECT_ID) id: ObjectId) {
    return this.fs.findOne({_id: id});
  }

  @Delete(":id")
  @UseGuards(AuthGuard(), ActionGuard("function:delete"))
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteOne(@Param("id", OBJECT_ID) id: ObjectId) {
    const fn = await this.fs.findOne({_id: id});
    if (!fn) {
      throw new NotFoundException("Can not find function.");
    }
    await this.fs.deleteOne(fn._id);
    await this.engine.host.delete(fn);
  }

  @Get(":id/run/:target")
  @Header("X-Content-Type-Options", "nosniff")
  @UseGuards(AuthGuard(), ActionGuard("function:run", "function/:id"))
  async run(@Param("id", OBJECT_ID) id: ObjectId, @Param("target") target: string, @Res() res) {
    const fn = await this.fs.findOne({_id: id});
    const logStream = new stream.PassThrough();
    logStream.pipe(res);
    return this.engine.run(fn, {id: fn._id, handler: target}, logStream);
  }

  @Get(":id/logs")
  @UseGuards(AuthGuard(), ActionGuard("function:show", "function/:id"))
  logs(
    @Param("id", OBJECT_ID) id: ObjectId,
    @Query("begin", DEFAULT(new Date().setUTCHours(0, 0, 0, 0)), DATE) begin: Date,
    @Query("end", DEFAULT(new Date().setUTCHours(23, 59, 59, 999)), DATE) end: Date
  ) {
    return this.loggerHost.query(id.toHexString(), {
      from: begin,
      until: end,
      sort: 1
    });
  }

  @Delete(":id/logs")
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthGuard(), ActionGuard("function:update", "function/:id"))
  clearLogs(@Param("id", OBJECT_ID) id: ObjectId) {
    return this.loggerHost.clear(id.toHexString());
  }

  @Post(":id/index")
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthGuard(), ActionGuard("function:update", "function/:id"))
  async addIndex(@Param("id", OBJECT_ID) id: ObjectId, @Body("index") index: string) {
    const fn = await this.fs.findOne({_id: id});
    if (!fn) {
      throw new NotFoundException("Cannot find function.");
    }
    return this.engine.host.update(fn, index);
  }

  @Get(":id/index")
  @UseGuards(AuthGuard(), ActionGuard("function:show", "function/:id"))
  async showIndex(@Param("id", OBJECT_ID) id: ObjectId) {
    const fn = await this.fs.findOne({_id: id});
    if (!fn) {
      throw new NotFoundException("Can not find function.");
    }
    const index = await this.engine.host.read(fn);
    return {index};
  }

  @Post(":id/dependencies")
  @UseGuards(AuthGuard(), ActionGuard("function:update", "function/:id"))
  async addDependency(@Param("id", OBJECT_ID) id: ObjectId, @Body("name") dependency: string) {
    if (!dependency) {
      throw new BadRequestException("Dependency name is required!");
    }

    const fn = await this.fs.findOne({_id: id});
    if (!fn) {
      throw new NotFoundException("Cannot find the function.");
    }

    const parsed = npa(dependency);
    if (!parsed.registry) {
      throw new BadRequestException("Dependency must refer to to package that hosted on registry.");
    }

    const version = semver.valid(parsed.fetchSpec);
    if (parsed.type != "tag" && !version) {
      throw new BadRequestException("Dependency version is not valid.");
    }

    return this.engine.host.addDependency(fn, dependency);
  }

  @Post(":id/delete-dependency")
  @UseGuards(AuthGuard(), ActionGuard("function:update", "function/:id"))
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteDependency(@Param("id", OBJECT_ID) id: ObjectId, @Body("name") dependency: string) {
    const fn = await this.fs.findOne({_id: id});

    return this.engine.host.deleteDependency(fn, dependency);
  }

  @Get(":id/dependencies")
  @UseGuards(AuthGuard(), ActionGuard("function:show", "function/:id"))
  async getDependencies(@Param("id", OBJECT_ID) id: ObjectId) {
    const fn = await this.fs.findOne({_id: id});
    if (!fn) {
      throw new NotFoundException("Can not find the function.");
    }
    return this.engine.host.getDependencies(fn);
  }
}
