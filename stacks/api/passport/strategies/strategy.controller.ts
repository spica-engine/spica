import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
  HttpException,
  HttpStatus
} from "@nestjs/common";
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
    return this.strategy.findOne({_id: id}).then(strategy => {
      strategy[
        "callbackUrl"
      ] = `${process.env.PUBLIC_HOST}/passport/strategy/${strategy.name}/complete`;
      return strategy;
    });
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

    const checkCertificate = util.promisify(pem.checkCertificate);
    return await checkCertificate(body.options.ip.certificate)
      .then(result => {
        if (result) {
          return this.strategy.replaceOne(body);
        }
      })
      .catch(err => {
        throw new HttpException(
          {
            status: HttpStatus.BAD_REQUEST,
            error: "Invalid Certificate"
          },
          400
        );
      });
  }
}
