import {Optional} from "@nestjs/common";
import {OnGatewayConnection, WebSocketGateway} from "@nestjs/websockets";
import {ReviewDispatcher} from "@spica-server/bucket/hooks";
import {ObjectId} from "@spica-server/database";
import {RealtimeDatabaseService, StreamChunk} from "@spica-server/database/realtime";
import {ActionGuardService, AuthGuardService} from "@spica-server/passport";
import {fromEvent, Observable} from "rxjs";
import {takeUntil, tap} from "rxjs/operators";

@WebSocketGateway({
  path: "/bucket/:id/data"
})
export class RealtimeGateway implements OnGatewayConnection {
  streams = new Map<string, Observable<StreamChunk<any>>>();

  constructor(
    private realtime: RealtimeDatabaseService,
    private authGuardService: AuthGuardService,
    private actionGuardService: ActionGuardService,
    @Optional() private reviewDispatcher: ReviewDispatcher
  ) {}

  async handleConnection(client: WebSocket, req) {
    req.headers.authorization = req.headers.authorization || req.query.get("Authorization");

    try {
      await this.authGuardService.check(req, client);
      await this.actionGuardService.check(req, client, "bucket:data:stream");
    } catch (e) {
      client.send(JSON.stringify({code: e.status || 500, message: e.message}));
      return client.close(1003);
    }

    const bucketId = req.params.id;
    const options: any = {};

    if (this.reviewDispatcher && req.headers["strategy-type"] == "APIKEY") {
      const filter = await this.reviewDispatcher.dispatch(
        {bucket: bucketId, type: "STREAM"},
        req.headers
      );
      if (typeof filter == "object" && Object.keys(filter).length > 0) {
        options.filter = options.filter || {};
        options.filter = {...options.filter, ...filter};
      }
    }

    if (req.query.has("filter")) {
      options.filter = JSON.parse(req.query.get("filter"));
    }

    if (req.query.has("sort")) {
      options.sort = JSON.parse(req.query.get("sort"));
    }

    if (req.query.has("limit")) {
      options.limit = Number(req.query.get("limit"));
    }

    if (req.query.has("skip")) {
      options.skip = Number(req.query.get("skip"));
    }

    const cursorName = `${bucketId}_${JSON.stringify(options)}`;
    let stream = this.streams.get(cursorName);
    if (!stream) {
      stream = this.realtime.find(getBucketDataCollection(bucketId), options).pipe(
        tap({
          complete: () => this.streams.delete(cursorName)
        })
      );
      this.streams.set(cursorName, stream);
    }
    stream.pipe(takeUntil(fromEvent(client, "close"))).subscribe(data => {
      client.send(JSON.stringify(data));
    });
  }
}

export function getBucketDataCollection(bucketId: string | ObjectId): string {
  return `bucket_${bucketId}`;
}
