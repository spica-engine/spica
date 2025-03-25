import {Controller, Body, Post, Inject} from "@nestjs/common";
import {Schema} from "@spica-server/core/schema";
import {Batch, HTTP_SERVICE, HTTPService} from "./interface";

@Controller("batch")
export class BatchController {
  constructor(@Inject(HTTP_SERVICE) private httpService: HTTPService) {}

  @Post()
  insert(@Body(Schema.validate("http://spica.internal/batch")) batch: Batch) {
    // implementation goes here
  }
}
