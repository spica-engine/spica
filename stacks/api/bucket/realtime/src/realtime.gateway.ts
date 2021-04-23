import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway
} from "@nestjs/websockets";
import * as expression from "@spica-server/bucket/expression";
import {aggregate} from "@spica-server/bucket/expression";
import {
  BucketService,
  getBucketDataCollection,
  filterReviver,
  BucketDataService
} from "@spica-server/bucket/services";
import {ObjectId} from "@spica-server/database";
import {
  FindOptions,
  RealtimeDatabaseService,
  StreamChunk,
  ChunkKind
} from "@spica-server/database/realtime";
import {GuardService} from "@spica-server/passport";
import {fromEvent, Observable, of} from "rxjs";
import {takeUntil, tap, catchError} from "rxjs/operators";

@WebSocketGateway({
  path: "/bucket/:id/data"
})
export class RealtimeGateway implements OnGatewayConnection {
  streams = new Map<string, Observable<StreamChunk<any>>>();

  // @TODO: try to simplize clients instead of use whole websocket object
  clients = new Map<WebSocket, {user: any; schema: any}>();

  constructor(
    private realtime: RealtimeDatabaseService,
    private guardService: GuardService,
    private bucketService: BucketService,
    private bucketDataService: BucketDataService
  ) {}

  async handleConnection(client: WebSocket, req) {
    req.headers.authorization = req.headers.authorization || req.query.get("Authorization");
    try {
      await this.guardService.checkAuthorization({
        request: req,
        response: client
      });
      await this.guardService.checkAction({
        request: req,
        response: client,
        actions: "bucket:data:stream",
        options: {resourceFilter: true}
      });
    } catch (e) {
      client.send(
        JSON.stringify({kind: ChunkKind.Error, code: e.status || 500, message: e.message})
      );
      return client.close(1003);
    }

    const schemaId = req.params.id;

    const schema = await this.bucketService.findOne({_id: new ObjectId(schemaId)});

    this.clients.set(client, {user: req.user, schema});

    const match = expression.aggregate(schema.acl.read, {auth: req.user});

    const options: FindOptions<{}> = {};

    let filter = req.query.get("filter");

    if (filter) {
      let parsedFilter = parseFilter((value: string) => JSON.parse(value, filterReviver), filter);

      if (!parsedFilter) {
        parsedFilter = parseFilter(aggregate, filter, {});
      }

      if (!parsedFilter) {
        client.send(
          JSON.stringify({
            kind: ChunkKind.Error,
            code: 400,
            message:
              "Error occured while parsing the filter. Please ensure that filter is a valid JSON or expression."
          })
        );

        this.clients.delete(client);

        return client.close(1003);
      }

      options.filter = {$and: [match, parsedFilter]};
    } else {
      options.filter = match;
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

    const cursorName = `${schemaId}_${JSON.stringify(options)}`;
    let stream = this.streams.get(cursorName);
    if (!stream) {
      stream = this.realtime.find(getBucketDataCollection(schemaId), options).pipe(
        catchError(error => {
          // send the error to the client, prevent to api down
          client.send(
            JSON.stringify({
              kind: ChunkKind.Error,
              code: 500,
              message: error.toString()
            })
          );
          client.close(1003);
          this.clients.delete(client);
          return of(null);
        }),
        tap({
          complete: () => {
            this.streams.delete(cursorName);
            this.clients.delete(client);
          }
        })
      );
      this.streams.set(cursorName, stream);
    }
    stream.pipe(takeUntil(fromEvent(client, "close"))).subscribe(data => {
      client.send(JSON.stringify(data));
    });
  }

  // @TODO:seperate endpoints
  @SubscribeMessage("events")
  handleEvent(client: any, data: any): any {
    /* @TODO: authenticate and authorize for each message 
    so we can detect expired tokens or changed policies */
    if (this.clients.has(client)) {
      const clientInfo = this.clients.get(client);
      // @TODO: find a way to prevent the circular dependency to use crud.ts methods
      this.bucketDataService.children(clientInfo.schema).insertOne(data);
    }
  }
}

export function parseFilter(method: (...params: any) => any, ...params: any) {
  try {
    return method(...params);
  } catch (e) {
    return false;
  }
}
