import {Controller, Body, Post, Inject, Req, UseGuards} from "@nestjs/common";
import {Schema} from "@spica-server/core/schema";
import {
  BatchRequest,
  BATCH_OPTIONS,
  BatchOptions,
  HTTP_SERVICE,
  HTTPResponse,
  HTTPService,
  Request,
  Response
} from "./interface";
import {AuthGuard} from "@spica-server/passport/guard";
import {getBaseUrl, handleResponse, splitIntoChunks} from "./utilities";

@Controller("batch")
export class BatchController {
  constructor(
    @Inject(HTTP_SERVICE) private httpService: HTTPService,
    @Inject(BATCH_OPTIONS) private options: BatchOptions
  ) {}

  @Post()
  @UseGuards(AuthGuard())
  async insert(
    @Body(Schema.validate("http://spica.internal/batch")) batch: BatchRequest,
    @Req() req
  ) {
    this.httpService.baseURL = getBaseUrl(req, this.options);

    const requestChunks = splitIntoChunks(batch.requests, batch.concurrency);

    const responses: Response[] = [];
    for (let requestChunk of requestChunks) {
      const responseHandler = (request, response) =>
        responses.push(handleResponse(request, response));

      await Promise.all(
        requestChunk.map(r =>
          this.httpService
            .request(r.url, r.method, undefined, r.headers, r.body)
            .then(rr => responseHandler(r, rr))
            .catch(e => responseHandler(r, e))
        )
      );
    }

    return responses;
  }
}
