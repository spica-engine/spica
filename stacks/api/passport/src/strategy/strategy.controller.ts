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
import {OAuthService} from "../oauth.service";
import {PassportOptions, PASSPORT_OPTIONS} from "../options";
import {SamlService} from "../saml.service";
import {Strategy, StrategyTypeService} from "./interface";
import {StrategyService} from "./strategy.service";

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
  insertOne(@Body() strategy: Strategy) {
    delete strategy._id;

    const desiredStrategy = this.getStrategyByType(strategy.type);

    try {
      desiredStrategy.prepareToInsert(strategy);
    } catch (error) {
      throw new BadRequestException(error.message);
    }

    return this.strategy.insertOne(strategy).then(s => {
      if (typeof desiredStrategy.afterInsert == "function") {
        return desiredStrategy.afterInsert(s);
      }
    });
  }

  @Put(":id")
  @UseGuards(AuthGuard(), ActionGuard("passport:strategy:update"))
  replaceOne(@Param("id", OBJECT_ID) id: ObjectId, @Body() strategy: Strategy) {
    delete strategy._id;

    const desiredStrategy = this.getStrategyByType(strategy.type);

    try {
      desiredStrategy.prepareToInsert(strategy);
    } catch (error) {
      throw new BadRequestException(error);
    }

    return this.strategy.findOneAndReplace({_id: id}, strategy);
  }

  getStrategyByType(type: string): StrategyTypeService {
    switch (type) {
      case "saml":
        return this.saml;
      case "oauth":
        return this.oauth;
      default:
        throw new BadRequestException("Unknown strategy. Available options are saml and oauth.");
    }
  }
}
