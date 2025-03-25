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
    this.httpService.baseURL = this.getBaseUrl(req);

    const requestChunks = this.spliceToChunks(batch.requests, batch.concurrency);

    const responses: Response[] = [];
    for (let requestChunk of requestChunks) {
      const responseHandler = (request, response) =>
        responses.push(this.handleResponse(request, response));

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

  private handleResponse(request: Request, response: HTTPResponse): Response {
    return {
      id: request.id,
      status: response.status,
      headers: response.headers,
      body: response.body
    };
  }

  private spliceToChunks<T>(items: T[], limit: number) {
    let chunks: T[][] = [];
    if (limit > 0) {
      while (items.length) {
        chunks.push(items.splice(0, limit));
      }
    } else {
      chunks = [items];
    }

    return chunks;
  }

  private getBaseUrl(req) {
    return `${req.protocol}://localhost:${this.options.port}`;
  }
}
