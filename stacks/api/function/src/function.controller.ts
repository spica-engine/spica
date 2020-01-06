import {
  Body,
  Controller,
  Delete,
  Get,
  // Header,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post,
  // Res,
  UseGuards
} from "@nestjs/common";
// import {DATE, DEFAULT} from "@spica-server/core";
import {Schema} from "@spica-server/core/schema";
import {ObjectId, OBJECT_ID} from "@spica-server/database";
import {Horizon} from "@spica-server/function/horizon";
import {ActionGuard, AuthGuard} from "@spica-server/passport";
// import * as npa from "npm-package-arg";
// import * as semver from "semver";
// import * as stream from "stream";
import {FunctionEngine} from "./engine";
// import {LoggerHost} from "./engine/logger";
import {FunctionService} from "./function.service";
import {Function} from "./interface";
import {generate} from "./schema/enqueuer.resolver";

@Controller("function")
export class FunctionController {
  constructor(
    private fs: FunctionService,
    private engine: FunctionEngine,
    private horizon: Horizon
  ) {}

  @Get("information")
  // @UseGuards(AuthGuard())
  information() {
    const enqueuers = [];

    for (const enqueuer of this.horizon.enqueuers) {
      enqueuers.push({
        description: enqueuer.description,
        options: this.engine.schemas.get(enqueuer.description.name)
      });
    }

    const runtimes = [];
    for (const runtime of this.horizon.runtimes) {
      runtimes.push({
        description: runtime.description
      });
    }

    return {enqueuers, runtimes};
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

  @Delete(":id")
  @UseGuards(AuthGuard(), ActionGuard("function:delete"))
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteOne(@Param("id", OBJECT_ID) id: ObjectId) {
    const deletedCount = await this.fs.deleteOne({_id: id});
    if (deletedCount == 0) {
      throw new NotFoundException("Couldn't find the function.");
    }
  }

  @Patch(":id")
  @UseGuards(AuthGuard(), ActionGuard("function:update"))
  updateOne(@Param("id", OBJECT_ID) id: ObjectId, @Body(Schema.validate(generate)) fn: Function) {
    delete fn._id;
    return this.fs.updateOne({_id: id}, {$set: fn});
  }

  @Post()
  @UseGuards(AuthGuard(), ActionGuard("function:create"))
  insertOne(@Body(Schema.validate(generate)) fn: Function) {
    fn._id = new ObjectId();
    return this.fs.insertOne(fn);
  }

  @Post(":id/index")
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthGuard(), ActionGuard("function:update", "function/:id"))
  async updateIndex(@Param("id", OBJECT_ID) id: ObjectId, @Body("index") index: string) {
    const fn = await this.fs.findOne({_id: id});
    if (!fn) {
      throw new NotFoundException("Cannot find function.");
    }
    return this.engine.update(fn, index);
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

  // @Get(":id/run/:target")
  // @Header("X-Content-Type-Options", "nosniff")
  // @UseGuards(AuthGuard(), ActionGuard("function:run", "function/:id"))
  // async run(@Param("id", OBJECT_ID) id: ObjectId, @Param("target") target: string, @Res() res) {
  //   const fn = await this.fs.findOne({_id: id});
  //   const logStream = new stream.PassThrough();
  //   logStream.pipe(res);
  //   return this.engine.run(fn, {id: fn._id, handler: target}, logStream);
  // }

  // @Get(":id/logs")
  // @UseGuards(AuthGuard(), ActionGuard("function:show", "function/:id"))
  // logs(
  //   @Param("id", OBJECT_ID) id: ObjectId,
  //   @Query("begin", DEFAULT(new Date().setUTCHours(0, 0, 0, 0)), DATE) begin: Date,
  //   @Query("end", DEFAULT(new Date().setUTCHours(23, 59, 59, 999)), DATE) end: Date
  // ) {
  //   return this.loggerHost.query(id.toHexString(), {
  //     from: begin,
  //     until: end,
  //     sort: 1
  //   });
  // }

  // @Delete(":id/logs")
  // @HttpCode(HttpStatus.NO_CONTENT)
  // @UseGuards(AuthGuard(), ActionGuard("function:update", "function/:id"))
  // clearLogs(@Param("id", OBJECT_ID) id: ObjectId) {
  //   return this.loggerHost.clear(id.toHexString());
  // }

  // @Post(":id/dependencies")
  // @UseGuards(AuthGuard(), ActionGuard("function:update", "function/:id"))
  // async addDependency(@Param("id", OBJECT_ID) id: ObjectId, @Body("name") dependency: string) {
  //   if (!dependency) {
  //     throw new BadRequestException("Dependency name is required!");
  //   }

  //   const fn = await this.fs.findOne({_id: id});
  //   if (!fn) {
  //     throw new NotFoundException("Cannot find the function.");
  //   }

  //   const parsed = npa(dependency);
  //   if (!parsed.registry) {
  //     throw new BadRequestException("Dependency must refer to to package that hosted on registry.");
  //   }

  //   const version = semver.valid(parsed.fetchSpec);
  //   if (parsed.type != "tag" && !version) {
  //     throw new BadRequestException("Dependency version is not valid.");
  //   }

  //   return this.engine.host.addDependency(fn, dependency);
  // }

  // @Post(":id/delete-dependency")
  // @UseGuards(AuthGuard(), ActionGuard("function:update", "function/:id"))
  // @HttpCode(HttpStatus.NO_CONTENT)
  // async deleteDependency(@Param("id", OBJECT_ID) id: ObjectId, @Body("name") dependency: string) {
  //   const fn = await this.fs.findOne({_id: id});

  //   return this.engine.host.deleteDependency(fn, dependency);
  // }

  // @Get(":id/dependencies")
  // @UseGuards(AuthGuard(), ActionGuard("function:show", "function/:id"))
  // async getDependencies(@Param("id", OBJECT_ID) id: ObjectId) {
  //   const fn = await this.fs.findOne({_id: id});
  //   if (!fn) {
  //     throw new NotFoundException("Can not find the function.");
  //   }
  //   return this.engine.host.getDependencies(fn);
  // }
}
