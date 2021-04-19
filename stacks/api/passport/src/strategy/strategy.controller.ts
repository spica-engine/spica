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
import {Schema} from "@spica-server/core/schema";
import {ObjectId, OBJECT_ID} from "@spica-server/database";
import {ActionGuard, AuthGuard, ResourceFilter} from "@spica-server/passport/guard";
import {OAuthService} from "./services/oauth.service";
import {PassportOptions, PASSPORT_OPTIONS} from "../options";
import {SamlService} from "./services/saml.service";
import {getStrategyService} from "../utilities";
import {Strategy} from "./interface";
import {StrategyService} from "./services/strategy.service";

@Controller("passport/strategy")
export class StrategyController {
  constructor(
    private strategy: StrategyService,
    private saml: SamlService,
    private oauth: OAuthService,
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
  async insertOne(@Body(Schema.validate("http://spica.internal/strategy")) strategy: Strategy) {
    delete strategy._id;

    const service = getStrategyService([this.saml, this.oauth], strategy.type);

    try {
      service.prepareToInsert(strategy);
    } catch (error) {
      throw new BadRequestException(error.message);
    }

    let insertedStrategy = await this.strategy.insertOne(strategy);

    if (service.afterInsert) {
      insertedStrategy = await service.afterInsert(insertedStrategy);
    }

    return insertedStrategy;
  }

  @Put(":id")
  @UseGuards(AuthGuard(), ActionGuard("passport:strategy:update"))
  async replaceOne(
    @Param("id", OBJECT_ID) id: ObjectId,
    @Body(Schema.validate("http://spica.internal/strategy")) strategy: Strategy
  ) {
    delete strategy._id;

    const service = getStrategyService([this.saml, this.oauth], strategy.type);

    try {
      service.prepareToInsert(strategy);
    } catch (error) {
      throw new BadRequestException(error);
    }

    let insertedStrategy = await this.strategy.findOneAndReplace({_id: id}, strategy);

    if (service.afterInsert) {
      insertedStrategy = await service.afterInsert(insertedStrategy);
    }

    return insertedStrategy;
  }
}
