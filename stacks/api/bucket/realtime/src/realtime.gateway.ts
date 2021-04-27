import {Inject, Injectable, Optional} from "@nestjs/common";
import {OnGatewayConnection, SubscribeMessage, WebSocketGateway} from "@nestjs/websockets";
import {Action, ActivityService} from "@spica-server/activity/services";
import {BucketCacheService} from "@spica-server/bucket/cache";
import {
  insertDocument,
  insertActivity,
  replaceDocument,
  createHistory,
  applyPatch,
  patchDocument
} from "@spica-server/bucket/common";
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

enum MessageKind {
  INSERT = "insert",
  REPLACE = "replace",
  PATCH = "patch",
  DELETE = "delete"
}

@WebSocketGateway({
  path: "/bucket/:id/data"
})
export class RealtimeGateway implements OnGatewayConnection {
  streams = new Map<string, Observable<StreamChunk<any>>>();

  // @TODO: try to simplize clients instead of use whole websocket object
  clients = new Map<WebSocket, {req: any; cursorName: string}>();

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

  async handleConnection(client: any, req) {
    req.headers.authorization = req.headers.authorization || req.query.get("Authorization");

    try {
      await this.authorize(req, client);
    } catch (error) {
      this.send(client, ChunkKind.Error, error.status, error.message);
      return client.close(1003);
    }

    const schemaId = req.params.id;

    if (!ObjectId.isValid(schemaId)) {
      this.send(client, ChunkKind.Error, 400, `${schemaId} is not a valid object id.`);
      return client.close(1003);
    }

    const schema = await this.bucketService.findOne({_id: new ObjectId(schemaId)});

    const match = expression.aggregate(schema.acl.read, {auth: req.user});

    const options: FindOptions<{}> = {};

    let filter = req.query.get("filter");

    if (filter) {
      let parsedFilter = parseFilter((value: string) => JSON.parse(value, filterReviver), filter);

      if (!parsedFilter) {
        parsedFilter = parseFilter(aggregate, filter, {});
      }

      if (!parsedFilter) {
        this.send(
          client,
          ChunkKind.Error,
          400,
          "Error occured while parsing the filter. Please ensure that filter is a valid JSON or expression."
        );

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

    this.clients.set(client, {req, cursorName});

    let stream = this.streams.get(cursorName);
    if (!stream) {
      stream = this.realtime.find(getBucketDataCollection(schemaId), options).pipe(
        catchError(error => {
          // send the error to the client, prevent to api down
          this.send(client, ChunkKind.Error, 500, error.toString());

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

  @SubscribeMessage(MessageKind.INSERT)
  async insert(client: any, document: any) {
    let schema;

    try {
      schema = await this.extractSchema(client);
    } catch (error) {
      return;
    }

    try {
      await this.validateDocument(schema._id.toString(), document);
    } catch (error) {
      return this.send(client, ChunkKind.Response, 400, error.message);
    }

    const {req} = this.clients.get(client);

    let insertedDoc;

    try {
      insertedDoc = await insertDocument(
        schema,
        document,
        {req},
        {
          collection: schema => this.bucketDataService.children(schema),
          schema: (bucketId: string) => this.bucketService.findOne({_id: new ObjectId(bucketId)}),
          //@TODO: create delete one method to track activity, recursive deletion etc
          deleteOne: id =>
            this.bucketDataService
              .children(schema)
              .deleteOne({_id: id})
              .then()
        }
      );
    } catch (error) {
      return this.send(client, ChunkKind.Response, error.status || 500, error.message);
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
          bucket: schema._id.toString(),
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
  }

  @SubscribeMessage(MessageKind.REPLACE)
  async replace(client: any, document: any) {
    let schema;

    try {
      schema = await this.extractSchema(client);
    } catch (error) {
      return;
    }

    if (!ObjectId.isValid(document._id)) {
      return this.send(client, ChunkKind.Response, 400, `${document._id} is an invalid object id`);
    }

    const documentId = new ObjectId(document._id);

    try {
      await this.validateDocument(schema._id.toString(), document);
    } catch (error) {
      return this.send(client, ChunkKind.Response, 400, error.message);
    }

    const {req} = this.clients.get(client);

    let previousDocument;

    try {
      previousDocument = await replaceDocument(
        schema,
        {...document, _id: documentId},
        {req},
        {
          collection: schema => this.bucketDataService.children(schema),
          schema: (bucketId: string) => this.bucketService.findOne({_id: new ObjectId(bucketId)})
        }
      );
    } catch (error) {
      return this.send(client, ChunkKind.Response, error.status || 500, error.message);
    }

    if (!previousDocument) {
      return this.send(
        client,
        ChunkKind.Response,
        404,
        `Could not find the document with id ${documentId.toHexString()}`
      );
    }

    await createHistory(this.bucketService, this.history, schema._id, previousDocument, document);

    if (this.activity) {
      await insertActivity(
        req,
        Action.PUT,
        schema._id.toString(),
        documentId.toHexString(),
        this.activity
      );
    }

    if (this.hookEmitter) {
      this.hookEmitter.emitChange(
        {
          bucket: schema._id.toString(),
          type: "insert"
        },
        documentId.toHexString(),
        previousDocument,
        document
      );
    }

    if (this.bucketCacheService) {
      await this.bucketCacheService.invalidate(schema._id.toString());
    }
  }

  @SubscribeMessage(MessageKind.PATCH)
  async patch(client: any, document: any) {
    let schema;

    try {
      schema = await this.extractSchema(client);
    } catch (error) {
      return;
    }

    if (!ObjectId.isValid(document._id)) {
      return this.send(client, ChunkKind.Response, 400, `${document._id} is an invalid object id`);
    }

    const documentId = new ObjectId(document._id);

    const previousDocument = await  this.bucketDataService.children(schema).findOne({_id: documentId});

    if (!previousDocument) {
      return this.send(
        client,
        ChunkKind.Response,
        404,
        `Could not find the document with id ${documentId}`
      );
    }

    const patchedDocument = applyPatch(previousDocument, document);

    try {
      await this.validateDocument(schema._id.toString(), patchedDocument);
    } catch (error) {
      return this.send(client, ChunkKind.Response, 400, error.message);
    }

    const {req} = this.clients.get(client);

    let currentDocument;

    try {
      currentDocument = await patchDocument(
        schema,
        {...patchedDocument, _id: documentId},
        document,
        {req},
        {
          collection: schema => this.bucketDataService.children(schema),
          schema: (bucketId: string) => this.bucketService.findOne({_id: new ObjectId(bucketId)})
        },
        {returnOriginal: false}
      );
    } catch (error) {
      return this.send(client, ChunkKind.Response, error.status || 500, error.message);
    }

    if (!currentDocument) {
      return this.send(
        client,
        ChunkKind.Response,
        404,
        `Could not find the document with id ${documentId.toHexString()}`
      );
    }

    await createHistory(
      this.bucketService,
      this.history,
      schema._id,
      previousDocument,
      currentDocument
    );

    if (this.activity) {
      await insertActivity(
        req,
        Action.PUT,
        schema._id.toString(),
        documentId.toHexString(),
        this.activity
      );
    }

    if (this.hookEmitter) {
      this.hookEmitter.emitChange(
        {
          bucket: schema._id.toString(),
          type: "insert"
        },
        documentId.toHexString(),
        previousDocument,
        currentDocument
      );
    }

    if (this.bucketCacheService) {
      await this.bucketCacheService.invalidate(schema._id.toString());
    }

    return;
  }

  validateDocument(schemaId: string, document: any): Promise<void> {
    const ValidatorMixin = Schema.validate(schemaId);
    const validationPipe: any = new ValidatorMixin(this.validator);

    return validationPipe.transform(document);
  }

  extractSchema(client: any): Promise<any> {
    return new Promise(async (resolve, reject) => {
      // //@TODO: test case => try to send message before subscription
      if (!this.clients.has(client)) {
        this.send(
          client,
          ChunkKind.Error,
          400,
          "Connection has been already lost. Be sure about connection has still alive before sending message."
        );
        client.close(1003);
        reject();
      }

      const {req, cursorName} = this.clients.get(client);

      try {
        await this.authorize(req, client);
      } catch (error) {
        this.clients.delete(client);
        this.streams.delete(cursorName);

        this.send(client, ChunkKind.Error, error.status, error.message);
        client.close(1003);
        reject();
      }

      if (!ObjectId.isValid(req.params.id)) {
        this.clients.delete(client);
        this.streams.delete(cursorName);

        this.send(client, ChunkKind.Error, 400, `${req.params.id} is an invalid object id.`);
        client.close(1003);
      }

      const schemaId = new ObjectId(req.params.id);

      const schema = await this.bucketService.findOne({_id: schemaId});

      if (!schema) {
        this.clients.delete(client);
        this.streams.delete(cursorName);

        this.send(
          client,
          ChunkKind.Error,
          400,
          `Could not find the schema with id ${schemaId.toString()}`
        );
        client.close(1003);
        reject();
      }

      resolve(schema);
    });
  }

  send(client, kind: ChunkKind, status: number, message: string) {
    client.send(JSON.stringify({kind, status, message}));
  }
}

export function parseFilter(method: (...params: any) => any, ...params: any) {
  try {
    return method(...params);
  } catch (e) {
    return false;
  }
}
