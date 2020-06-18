import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Post,
  UseGuards
} from "@nestjs/common";
import {ObjectId, OBJECT_ID} from "@spica-server/database";
import * as forge from "node-forge";
import {AuthGuard} from "../auth.guard";
import {Strategy} from "../interface";
import {PassportOptions, PASSPORT_OPTIONS} from "../options";
import {ActionGuard} from "../policy";
import {StrategyService} from "./strategy.service";

@Controller("strategies")
export class StrategyController {
  constructor(
    private strategy: StrategyService,
    @Inject(PASSPORT_OPTIONS) private options: PassportOptions
  ) {}

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
      ] = `${this.options.publicUrl}/passport/strategy/${strategy.name}/complete`;
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
  async replaceOne(@Body() strategy: Strategy) {
    strategy._id = new ObjectId(strategy._id);
    if (strategy.options.sp) {
      const {validity} = forge.pki.certificateFromPem(strategy.options.sp.certificate);
      if (validity.notAfter < new Date()) {
        strategy.options.sp = undefined;
      }
    }

    if (!strategy.options.sp) {
      const keys = forge.pki.rsa.generateKeyPair(2048);
      const cert = forge.pki.createCertificate();
      const attrs: forge.pki.CertificateField[] = [
        {name: "commonName", value: "spica.io"},
        {name: "organizationName", value: "spica"}
      ];

      cert.publicKey = keys.publicKey;
      cert.serialNumber = strategy._id.toHexString();
      cert.validity.notBefore = new Date();
      cert.validity.notAfter = new Date();
      cert.validity.notAfter.setSeconds(
        cert.validity.notBefore.getSeconds() + this.options.samlCertificateTTL
      );

      cert.setSubject(attrs);
      cert.setIssuer(attrs);
      cert.sign(keys.privateKey);
      strategy.options.sp = {
        certificate: forge.pki.certificateToPem(cert),
        private_key: forge.pki.privateKeyToPem(keys.privateKey)
      };
    }

    try {
      forge.pki.certificateFromPem(strategy.options.ip.certificate);
    } catch (error) {
      throw new BadRequestException(error.message, "Invalid Certificate");
    }

    return this.strategy.findOneAndReplace({_id: strategy._id}, strategy, {
      returnOriginal: false,
      upsert: true
    });
  }
}
