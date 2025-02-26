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
import {ObjectId, OBJECT_ID, ReturnDocument} from "@spica-server/database";
import {ActionGuard, AuthGuard, ResourceFilter} from "@spica-server/passport/guard";
import {PassportOptions, PASSPORT_OPTIONS, STRATEGIES} from "../options";
import {Strategy, StrategyTypeService} from "./interface";
import {StrategyService} from "./services/strategy.service";

@Controller("passport/strategy")
export class StrategyController {
  constructor(
    private strategy: StrategyService,
    @Inject(STRATEGIES) private strategies: {find: (type: string) => StrategyTypeService},
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
      strategy["callbackUrl"] =
        `${this.options.publicUrl}/passport/strategy/${strategy._id}/complete`;
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

    const service = this.strategies.find(strategy.type);

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

    const service = this.strategies.find(strategy.type);

    try {
      service.prepareToInsert(strategy);
    } catch (error) {
      throw new BadRequestException(error);
    }

    let updatedStrategy = await this.strategy.findOneAndReplace({_id: id}, strategy, {
      returnDocument: ReturnDocument.AFTER
    });

    if (service.afterInsert) {
      updatedStrategy = await service.afterInsert(updatedStrategy);
    }

    return updatedStrategy;
  }

  @Get("presets/:idp")
  @UseGuards(AuthGuard(), ActionGuard("passport:strategy:show"))
  getPresets(@Param("idp") idp: string) {
    const presets = {
      google: {
        type: "oauth",
        name: "Google OAuth",
        title: "Google OAuth",
        icon: "login",
        options: {
          code: {
            base_url: "https://accounts.google.com/o/oauth2/v2/auth",
            params: {
              response_type: "code",
              scope: "email",
              client_id: null
            },
            headers: {},
            method: "get"
          },
          access_token: {
            base_url: "https://oauth2.googleapis.com/token",
            params: {
              grant_type: "authorization_code",
              client_id: null,
              client_secret: null
            },
            headers: {},
            method: "post"
          },
          identifier: {
            base_url: "https://www.googleapis.com/oauth2/v2/userinfo",
            params: {},
            headers: {},
            method: "get"
          }
        }
      },
      facebook: {
        type: "oauth",
        name: "Facebook OAuth",
        title: "Facebook OAuth",
        icon: "login",
        options: {
          code: {
            base_url: "https://www.facebook.com/v22.0/dialog/oauth",
            params: {
              client_id: null
            },
            headers: {},
            method: "get"
          },
          access_token: {
            base_url: "https://graph.facebook.com/v22.0/oauth/access_token",
            params: {
              client_id: null,
              client_secret: null
            },
            headers: {},
            method: "get"
          },
          identifier: {
            base_url: "https://graph.facebook.com/me",
            params: {
              fields: "email"
            },
            headers: {},
            method: "get"
          }
        }
      },
      github: {
        type: "oauth",
        name: "Github OAuth",
        title: "Github OAuth",
        icon: "login",
        options: {
          code: {
            base_url: "https://github.com/login/oauth/authorize",
            params: {
              scope: "user",
              client_id: null
            },
            headers: {},
            method: "get"
          },
          access_token: {
            base_url: "https://github.com/login/oauth/access_token",
            params: {
              client_id: null,
              client_secret: null
            },
            headers: {},
            method: "post"
          },
          identifier: {
            base_url: "https://api.github.com/user",
            params: {},
            headers: {},
            method: "get"
          }
        }
      }
    };

    const preset = presets[idp];

    if (!preset) {
      throw new BadRequestException("Preset for this identity provider not found.");
    }
    return preset;
  }
}
