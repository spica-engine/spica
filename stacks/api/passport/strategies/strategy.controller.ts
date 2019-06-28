import {Body, Controller, Delete, Get, Param, Post, UseGuards} from "@nestjs/common";
import {ObjectId, OBJECT_ID} from "@spica-server/database";
import * as pem from "pem";
import * as util from "util";
import {AuthGuard} from "../auth.guard";
import {Strategy} from "../interface";
import {ActionGuard} from "../policy";
import {StrategyService} from "./strategy.service";

@Controller("strategies")
export class StrategyController {
  constructor(private strategy: StrategyService) {}

  @Get()
  @UseGuards(AuthGuard(), ActionGuard("passport:strategy:index"))
  find() {
    return this.strategy.find();
  }

  @Get(":id")
  @UseGuards(AuthGuard(), ActionGuard("passport:strategy:show"))
  findOne(@Param("id", OBJECT_ID) id: ObjectId) {
    return this.strategy.findOne({_id: id});
  }

  @Delete(":id")
  @UseGuards(AuthGuard(), ActionGuard("passport:strategy:delete"))
  deleteOne(@Param("id", OBJECT_ID) id: ObjectId) {
    return this.strategy.deleteOne({_id: id});
  }

  @Post()
  @UseGuards(AuthGuard(), ActionGuard("passport:strategy:update"))
  async replaceOne(@Body() body: Strategy) {
    if (!body._id) {
      const createCertificate = util.promisify(pem.createCertificate);
      const certificate = await createCertificate({
        days: 365,
        selfSigned: true
      });

      body.options.sp = {
        certificate: certificate.certificate,
        private_key: certificate.serviceKey
      };
    }
    return this.strategy.replaceOne(body);
  }
}
