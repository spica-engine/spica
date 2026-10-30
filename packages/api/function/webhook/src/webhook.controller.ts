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
  Optional,
  Param,
  Post,
  Put,
  Query,
  UseGuards
} from "@nestjs/common";
import {DEFAULT, JSONP, NUMBER} from "@spica-server/core";
import {Schema} from "@spica-server/core-schema";
import {ID} from "@spica-server/data";
import {
  COLLECTION_NAMES,
  COLLECTION_QUERY,
  CollectionNames,
  CollectionQueryFacade,
  Id
} from "@spica-server/interface-data";
import {ActionGuard, AuthGuard, ResourceFilter} from "@spica-server/passport-guard";
import {Webhook} from "@spica-server/interface-function-webhook";
import {WebhookInvoker} from "./invoker.js";
import {WebhookService} from "./webhook.service.js";
import {CollectionSlug, COLL_SLUG} from "@spica-server/interface-function";

const WEBHOOK_COLLECTION = "webhook";

@Controller("webhook")
export class WebhookController {
  constructor(
    private webhookService: WebhookService,
    private invoker: WebhookInvoker,
    @Inject(COLLECTION_NAMES) private collectionNames: CollectionNames,
    @Inject(COLLECTION_QUERY) private queries: CollectionQueryFacade,
    @Optional() @Inject(COLL_SLUG) private collSlug: CollectionSlug
  ) {}

  @Get("collections")
  @UseGuards(AuthGuard(["IDENTITY", "APIKEY"]))
  collections() {
    return this.collectionNames.list().then(names => {
      const definitions: {id: string; slug: string}[] = [];

      const promises = names.map(collName => {
        let promise = Promise.resolve(collName);

        if (this.collSlug) {
          promise = this.collSlug(collName);
        }

        return promise.then(slug =>
          definitions.push({
            id: collName,
            slug: slug
          })
        );
      });

      return Promise.all(promises).then(() => definitions);
    });
  }

  @Get()
  @UseGuards(AuthGuard(["IDENTITY", "APIKEY"]), ActionGuard("webhook:index"))
  find(
    @ResourceFilter({collection: WEBHOOK_COLLECTION}) resourceFilter: object,
    @Query("limit", DEFAULT(10), NUMBER) limit: number,
    @Query("skip", DEFAULT(0), NUMBER) skip: number,
    @Query("sort", DEFAULT({_id: -1}), JSONP) sort: {[path: string]: 1 | -1}
  ) {
    return this.queries.paginate(WEBHOOK_COLLECTION, {resourceFilter, sort, skip, limit}, "exact");
  }

  @Get(":id")
  @UseGuards(AuthGuard(["IDENTITY", "APIKEY"]), ActionGuard("webhook:show"))
  findOne(@Param("id", ID(WEBHOOK_COLLECTION)) id: Id) {
    return this.webhookService.findById(id);
  }

  @Post()
  @UseGuards(AuthGuard(["IDENTITY", "APIKEY"]), ActionGuard("webhook:create"))
  insertOne(@Body(Schema.validate("http://spica.internal/webhook")) hook: Webhook) {
    try {
      this.invoker.preCompile(hook.body);
    } catch (error) {
      throw new BadRequestException(error.toString());
    }
    return this.webhookService.insert(hook);
  }

  @Put(":id")
  @UseGuards(AuthGuard(["IDENTITY", "APIKEY"]), ActionGuard("webhook:update"))
  async replaceOne(
    @Param("id", ID(WEBHOOK_COLLECTION)) id: Id,
    @Body(Schema.validate("http://spica.internal/webhook")) hook: Webhook
  ) {
    try {
      this.invoker.preCompile(hook.body);
    } catch (error) {
      throw new BadRequestException(error.toString());
    }
    const res = await this.webhookService.replaceById(id, hook);
    if (!res) {
      throw new NotFoundException(`Webhook with ID ${id} not found`);
    }
    return res;
  }

  @Delete(":id")
  @UseGuards(AuthGuard(["IDENTITY", "APIKEY"]), ActionGuard("webhook:delete"))
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteOne(@Param("id", ID(WEBHOOK_COLLECTION)) id: Id) {
    const res = await this.webhookService.deleteById(id);
    if (!res) {
      throw new NotFoundException(`Webhook with ID ${id} not found`);
    }
  }
}
