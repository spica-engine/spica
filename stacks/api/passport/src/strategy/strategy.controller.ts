import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Post,
  Put,
  UseGuards
} from "@nestjs/common";
import {ObjectId, OBJECT_ID} from "@spica-server/database";
import {ActionGuard, AuthGuard, ResourceFilter} from "@spica-server/passport/guard";
import * as forge from "node-forge";
import {PassportOptions, PASSPORT_OPTIONS} from "../options";
import {Strategy} from "./interface";
import {StrategyService} from "./strategy.service";

@Controller("passport/strategy")
export class StrategyController {
  constructor(
    private strategy: StrategyService,
    @Inject(PASSPORT_OPTIONS) private options: PassportOptions
  ) {}

  @Get()
  @UseGuards(AuthGuard(), ActionGuard("passport:strategy:index"))
  find(@ResourceFilter() resourceFilter: object) {
    return this.strategy.aggregate([resourceFilter]).toArray();
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
  @UseGuards(AuthGuard(), ActionGuard("passport:strategy:insert"))
  insertOne(@Body() strategy: Strategy) {
    delete strategy._id;

    try {
      forge.pki.certificateFromPem(strategy.options.ip.certificate);
    } catch (error) {
      throw new BadRequestException(error.message, "Invalid Certificate");
    }

    generateCertificatesIfNeeded(strategy, this.options.samlCertificateTTL);

    return this.strategy.insertOne(strategy);
  }

  @Put(":id")
  @UseGuards(AuthGuard(), ActionGuard("passport:strategy:update"))
  replaceOne(@Param("id", OBJECT_ID) id: ObjectId, @Body() strategy: Strategy) {
    delete strategy._id;

    try {
      forge.pki.certificateFromPem(strategy.options.ip.certificate);
    } catch (error) {
      throw new BadRequestException(error.message, "Invalid Certificate");
    }

    generateCertificatesIfNeeded(strategy, this.options.samlCertificateTTL);

    return this.strategy.findOneAndReplace({_id: id}, strategy);
  }
}

function generateCertificatesIfNeeded(strategy: Strategy, ttl: number) {
  if (strategy.options.sp) {
    try {
      const {validity} = forge.pki.certificateFromPem(strategy.options.sp.certificate);
      if (validity.notAfter < new Date()) {
        strategy.options.sp = undefined;
      }
    } catch {
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
    cert.validity.notBefore = new Date();
    cert.validity.notAfter = new Date();
    cert.validity.notAfter.setSeconds(cert.validity.notBefore.getSeconds() + ttl);

    cert.setSubject(attrs);
    cert.setIssuer(attrs);
    cert.sign(keys.privateKey);
    strategy.options.sp = {
      certificate: forge.pki.certificateToPem(cert),
      private_key: forge.pki.privateKeyToPem(keys.privateKey)
    };
  }
}
