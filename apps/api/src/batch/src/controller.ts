import {Controller, Body, Post} from "@nestjs/common";
import {Schema} from "@spica-server/core/schema";
import {Batch} from "./interface";

@Controller("batch")
export class BatchController {
  constructor() {}

  @Post()
  insert(@Body(Schema.validate("http://spica.internal/batch")) batch: Batch) {
    // implementation goes here
  }
}
