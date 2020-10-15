import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  UseGuards
} from "@nestjs/common";
import { DEFAULT, NUMBER } from "@spica-server/core";
import { Schema } from "@spica-server/core/schema";
import { DatabaseService, ObjectId, OBJECT_ID } from "@spica-server/database";
import { ActionGuard, AuthGuard, ResourceFilter } from "@spica-server/passport/guard";
import { Webhook } from "./interface";
import { WebhookInvoker } from "./invoker";
import { WebhookService } from "./webhook.service";

@Controller("webhook")
export class WebhookController {
  constructor(
    private webhookService: WebhookService,
    private invoker: WebhookInvoker,
    private database: DatabaseService
  ) { }

  @Get("collections")
  @UseGuards(AuthGuard())
  collections(
    @ResourceFilter() resourceFilter: object,
  ) {
    return this.database
      .collections()
      .then(collections => collections.map(coll => coll.collectionName));
  }

  @Get()
  @UseGuards(AuthGuard(), ActionGuard("webhook:index"))
  find(
    @ResourceFilter() resourceFilter: object,
    @Query("limit", DEFAULT(10), NUMBER) limit: number,
    @Query("skip", DEFAULT(0), NUMBER) skip: number
  ) {
    const aggregate = [
      resourceFilter,
      {
        $facet: {
          meta: [{ $count: "total" }],
          data: [{ $skip: skip }, { $limit: limit }]
        }
      },
      {
        $set: {
          meta: { $ifNull: [{ $arrayElemAt: ["$meta", 0] }, { total: 0 }] }
        }
      }
    ];
    return this.webhookService.aggregate(aggregate).next();
  }

  @Get(":id")
  @UseGuards(AuthGuard(), ActionGuard("webhook:show"))
  findOne(@Param("id", OBJECT_ID) id: ObjectId) {
    return this.webhookService.findOne({ _id: id });
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
    return this.webhookService.findOneAndReplace({ _id: id }, hook, { returnOriginal: false });
  }

  @Delete(":id")
  @UseGuards(AuthGuard(), ActionGuard("webhook:delete"))
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteOne(@Param("id", OBJECT_ID) id: ObjectId) {
    return this.webhookService.deleteOne({ _id: id }).then(() => { });
  }
}
