import {Controller, Body, Post, Inject, Req, UseGuards} from "@nestjs/common";
import {Schema} from "@spica-server/core-schema";
import {AuthGuard} from "@spica-server/passport-guard";
import {getBaseUrl, handleResponse, splitIntoChunks} from "./utilities.js";
import {
  BatchRequest,
  BATCH_OPTIONS,
  BatchOptions,
  HTTP_SERVICE,
  HTTPService,
  Response
} from "@spica-server/interface-batch";

@Controller("batch")
export class BatchController {
  constructor(
    @Inject(HTTP_SERVICE) private httpService: HTTPService,
    @Inject(BATCH_OPTIONS) private options: BatchOptions
  ) {}

  @Post()
  @UseGuards(AuthGuard())
  async insert(
    @Body(Schema.validate("http://spica.internal/batch")) batch: BatchRequest<any>,
    @Req() req
  ) {
    this.httpService.baseURL = getBaseUrl(req, this.options);
    const requestChunks = splitIntoChunks(batch.requests, batch.concurrency);

    /**
     * The responses come back in **request** order, not completion order.
     *
     * They used to be `push`ed from inside `Promise.all`, so a request that finished first landed first
     * and the order of the array was whatever the network decided. Each response carries its `id`, so a
     * caller could always match them up — but an unspecified order is a promise nobody can rely on, and
     * it showed up as a test that reddened the build at random under load. Writing into the slot the
     * request came from costs nothing and makes the response order the caller's own.
     */
    const responses: Response[] = new Array(batch.requests.length);
    let offset = 0;
    for (const requestChunk of requestChunks) {
      const base = offset;
      offset += requestChunk.length;

      await Promise.all(
        requestChunk.map((r, index) =>
          this.httpService
            .request(r.url, r.method, undefined, r.headers, r.body)
            .then(rr => {
              responses[base + index] = handleResponse(r, rr);
            })
            .catch(e => {
              responses[base + index] = handleResponse(r, e);
            })
        )
      );
    }

    return {responses};
  }
}
