import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  NotFoundException,
  Param,
  Post,
  Put,
  UseGuards
} from "@nestjs/common";
import {Schema} from "@spica-server/core-schema";
import {ID} from "@spica-server/data";
import {COLLECTION_QUERY, CollectionQueryFacade, Id} from "@spica-server/interface-data";
import {ActionGuard, AuthGuard, ResourceFilter} from "@spica-server/passport-guard";
import {PassportOptions, PASSPORT_OPTIONS, STRATEGIES} from "@spica-server/interface-passport";
import {
  Strategy,
  STRATEGY_REPOSITORY,
  StrategyRepository,
  StrategyTypeServices
} from "@spica-server/interface-passport";

const STRATEGY_COLLECTION = "strategy";

@Controller("passport/strategy")
export class StrategyController {
  constructor(
    @Inject(STRATEGY_REPOSITORY) private strategy: StrategyRepository,
    @Inject(STRATEGIES)
    private strategies: StrategyTypeServices,
    @Inject(PASSPORT_OPTIONS) private options: PassportOptions,
    @Inject(COLLECTION_QUERY) private queries: CollectionQueryFacade
  ) {}

  @Get()
  @UseGuards(AuthGuard(["IDENTITY", "APIKEY"]), ActionGuard("passport:strategy:index"))
  find(@ResourceFilter({collection: STRATEGY_COLLECTION}) resourceFilter: object) {
    return this.queries.find(STRATEGY_COLLECTION, {resourceFilter});
  }

  @Get(":id")
  @UseGuards(AuthGuard(["IDENTITY", "APIKEY"]), ActionGuard("passport:strategy:show"))
  findOne(@Param("id", ID(STRATEGY_COLLECTION)) id: Id) {
    return this.strategy.findById(id).then(strategy => {
      const scope = strategy.type === "oauth" ? "user" : "identity";
      strategy["callbackUrl"] =
        `${this.options.publicUrl}/passport/${scope}/strategy/${strategy._id}/complete`;
      return strategy;
    });
  }

  @Delete(":id")
  @UseGuards(AuthGuard(["IDENTITY", "APIKEY"]), ActionGuard("passport:strategy:delete"))
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteOne(@Param("id", ID(STRATEGY_COLLECTION)) id: Id) {
    return this.strategy.deleteById(id);
  }

  @Post()
  @UseGuards(AuthGuard(["IDENTITY", "APIKEY"]), ActionGuard("passport:strategy:insert"))
  async insertOne(@Body(Schema.validate("http://spica.internal/strategy")) strategy: Strategy) {
    delete strategy._id;

    const service = this.strategies.find(strategy.type, strategy.options.idp);

    let preparedStrategy;

    try {
      preparedStrategy = service.prepareToInsert(strategy);
    } catch (error) {
      throw new BadRequestException(error.message);
    }

    let insertedStrategy = await this.strategy.insert(preparedStrategy);

    if (service.afterInsert) {
      insertedStrategy = await service.afterInsert(insertedStrategy);
    }

    return insertedStrategy;
  }

  @Put(":id")
  @UseGuards(AuthGuard(["IDENTITY", "APIKEY"]), ActionGuard("passport:strategy:update"))
  async replaceOne(
    @Param("id", ID(STRATEGY_COLLECTION)) id: Id,
    @Body(Schema.validate("http://spica.internal/strategy")) strategy: Strategy
  ) {
    delete strategy._id;

    const existingStrategy = await this.strategy.findById(id);

    if (!existingStrategy) {
      throw new NotFoundException("Strategy does not exist.");
    }

    if (
      strategy.type != existingStrategy.type ||
      strategy.options?.idp != existingStrategy.options?.idp
    ) {
      throw new BadRequestException("Type and identity provider of a strategy cannot be changed.");
    }

    const service = this.strategies.find(existingStrategy.type, existingStrategy.options?.idp);

    let preparedStrategy;

    try {
      preparedStrategy = service.prepareToInsert(strategy);
    } catch (error) {
      throw new BadRequestException(error.message);
    }

    let updatedStrategy = await this.strategy.replaceById(id, preparedStrategy);

    if (service.afterInsert) {
      updatedStrategy = await service.afterInsert(updatedStrategy);
    }

    return updatedStrategy;
  }
}
