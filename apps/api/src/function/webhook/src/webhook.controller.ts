import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Optional,
  Param,
  Post,
  Put,
  Query,
  UseGuards
} from "@nestjs/common";
import {DEFAULT, JSONP, NUMBER} from "@spica-server/core";
import {Schema} from "@spica-server/core/schema";
import {DatabaseService, ObjectId, OBJECT_ID, ReturnDocument} from "@spica-server/database";
import {ActionGuard, AuthGuard, ResourceFilter} from "@spica-server/passport/guard";
import {Webhook} from "@spica-server/interface/function/webhook";
import {WebhookInvoker} from "./invoker";
import {WebhookService} from "./webhook.service";
import {CollectionSlug, COLL_SLUG} from "@spica-server/interface/function";

@Controller("webhook")
export class WebhookController {
  constructor(
    private webhookService: WebhookService,
    private invoker: WebhookInvoker,
    private database: DatabaseService,
    @Optional() @Inject(COLL_SLUG) private collSlug: CollectionSlug
  ) {}

  @Get("collections")
  @UseGuards(AuthGuard())
  collections() {
    return this.database.collections().then(collections => {
      const definitions: {id: string; slug: string}[] = [];

      const promises = collections.map(collection => {
        const collName = collection.collectionName;

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
  @UseGuards(AuthGuard(), ActionGuard("webhook:index"))
  find(
    @ResourceFilter() resourceFilter: object,
    @Query("limit", DEFAULT(10), NUMBER) limit: number,
    @Query("skip", DEFAULT(0), NUMBER) skip: number,
    @Query("sort", DEFAULT({_id: -1}), JSONP) sort: {[k: string]: number}
  ) {
    const aggregate = [
      resourceFilter,
      {
        $facet: {
          meta: [{$count: "total"}],
          data: [{$sort: sort}, {$skip: skip}, {$limit: limit}]
        }
      },
      {
        $set: {
          meta: {$ifNull: [{$arrayElemAt: ["$meta", 0]}, {total: 0}]}
        }
      }
    ];
    return this.webhookService.aggregate(aggregate).next();
  }

  @Get(":id")
  @UseGuards(AuthGuard(), ActionGuard("webhook:show"))
  findOne(@Param("id", OBJECT_ID) id: ObjectId) {
    return this.webhookService.findOne({_id: id});
  }

  @Post()
  @UseGuards(AuthGuard(), ActionGuard("webhook:create"))
  insertOne(@Body(Schema.validate("http://spica.internal/webhook")) hook: Webhook) {
    try {
      this.invoker.preCompile(hook.body);
    } catch (error) {
      throw new BadRequestException(error.toString());
    }
    return this.webhookService.insertOne(hook);
  }

  @Put(":id")
  @UseGuards(AuthGuard(), ActionGuard("webhook:update"))
  replaceOne(
    @Param("id", OBJECT_ID) id: ObjectId,
    @Body(Schema.validate("http://spica.internal/webhook")) hook: Webhook
  ) {
    try {
      this.invoker.preCompile(hook.body);
    } catch (error) {
      throw new BadRequestException(error.toString());
    }
    return this.webhookService.findOneAndReplace({_id: id}, hook, {
      returnDocument: ReturnDocument.AFTER
    });
  }

  @Delete(":id")
  @UseGuards(AuthGuard(), ActionGuard("webhook:delete"))
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteOne(@Param("id", OBJECT_ID) id: ObjectId) {
    return this.webhookService.deleteOne({_id: id}).then(() => {});
  }
}
