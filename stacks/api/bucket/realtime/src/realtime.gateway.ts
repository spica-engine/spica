import {Optional} from "@nestjs/common";
import {OnGatewayConnection, SubscribeMessage, WebSocketGateway} from "@nestjs/websockets";
import {Action, ActivityService} from "@spica-server/activity/services";
import {BucketCacheService} from "@spica-server/bucket/cache";
import {HttpException, insertDocument, insertActivity} from "@spica-server/bucket/common";
import * as expression from "@spica-server/bucket/expression";
import {aggregate} from "@spica-server/bucket/expression";
import {HistoryService} from "@spica-server/bucket/history";
import {ChangeEmitter} from "@spica-server/bucket/hooks";
import {
  BucketService,
  getBucketDataCollection,
  filterReviver,
  BucketDataService
} from "@spica-server/bucket/services";
import {Schema, Validator} from "@spica-server/core/schema";
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
  clients = new Map<WebSocket, any>();

  constructor(
    private realtime: RealtimeDatabaseService,
    private guardService: GuardService,
    private bucketService: BucketService,
    private bucketDataService: BucketDataService,
    private validator: Validator,
    @Optional() private activity: ActivityService,
    @Optional() private history: HistoryService,
    @Optional() private hookEmitter: ChangeEmitter,
    @Optional() private bucketCacheService: BucketCacheService
  ) {}

  async authorize(req, client) {
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
  }

  async handleConnection(client: WebSocket, req) {
    req.headers.authorization = req.headers.authorization || req.query.get("Authorization");

    try {
      await this.authorize(req, client);
    } catch (error) {
      client.send(
        JSON.stringify({kind: ChunkKind.Error, code: error.status || 500, message: error.message})
      );
      client.close(1003);
      return;
    }

    const schemaId = req.params.id;

    const schema = await this.bucketService.findOne({_id: new ObjectId(schemaId)});

    this.clients.set(client, req);

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

  @SubscribeMessage("message")
  async insert(client: any, {kind, document}: {kind: OperationKind; document: any}) {
    // connection may lost before send message
    if (!this.clients.has(client)) {
      this.clients.delete(client);
      return {
        code: 400,
        message:
          "Connection has been already lost. Be sure about connection has still alive before sending message."
      };
    }

    const req = this.clients.get(client);

    // authorization
    try {
      await this.authorize(req, client);
    } catch (error) {
      return {code: error.status || 500, message: error.message};
    }

    const schemaId = req.params.id;

    switch (kind) {
      case OperationKind.INSERT:
        try {
          await this.validateDocument(schemaId, document);
        } catch (error) {
          return {
            code: 400,
            message: error.message
          };
        }

        const schema = await this.bucketService.findOne({_id: new ObjectId(schemaId)});

        let insertedDoc;

        try {
          insertedDoc = await insertDocument(
            schema,
            document,
            {req},
            {
              collection: schema => this.bucketDataService.children(schema),
              schema: _ => Promise.resolve(schema),
              //@TODO: create delete one method to track activity, recursive deletion etc
              deleteOne: id =>
                this.bucketDataService
                  .children(schema)
                  .deleteOne({_id: id})
                  .then()
            }
          );
        } catch (error) {
          return {
            status: error.status,
            message: error.message
          };
        }

        if (this.activity) {
          await insertActivity(
            req,
            Action.POST,
            schema._id.toString(),
            insertedDoc._id.toString(),
            this.activity
          );
        }

        if (this.hookEmitter) {
          this.hookEmitter.emitChange(
            {
              bucket: schemaId.toString(),
              type: "insert"
            },
            insertedDoc._id.toHexString(),
            undefined,
            insertedDoc
          );
        }

        if (this.bucketCacheService) {
          await this.bucketCacheService.invalidate(schema._id.toString());
        }

        return;

      case OperationKind.REPLACE:
    }

    return;
  }

  validateDocument(schemaId: string, document: any): Promise<void> {
    const ValidatorMixin = Schema.validate(schemaId);
    const validationPipe: any = new ValidatorMixin(this.validator);

    return validationPipe.transform(document);
  }
}

export enum OperationKind {
  INSERT = 0,
  REPLACE = 1,
  PATCH = 2,
  DELETE = 3
}

export function parseFilter(method: (...params: any) => any, ...params: any) {
  try {
    return method(...params);
  } catch (e) {
    return false;
  }
}
