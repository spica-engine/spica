import {Inject, Optional} from "@nestjs/common";
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway
} from "@nestjs/websockets";
import {ActivityService} from "@spica-server/activity/services";
import {BucketCacheService} from "@spica-server/bucket/cache";
import {
  insertDocument,
  insertActivity,
  replaceDocument,
  patchDocument,
  deleteDocument,
  clearRelations,
  getDependents,
  authIdToString,
  filterReviver,
  constructFilterValues
} from "@spica-server/bucket/common";
import * as expression from "@spica-server/bucket/expression";
import {aggregate} from "@spica-server/bucket/expression";
import {HistoryService} from "@spica-server/bucket/history";
import {ChangeEmitter} from "@spica-server/bucket/hooks";
import {
  BucketService,
  getBucketDataCollection,
  BucketDataService
} from "@spica-server/bucket/services";
import {applyPatch, deepCopy} from "@spica-server/core/patch";
import {Schema, Validator} from "@spica-server/core/schema";
import {ObjectId, ReturnDocument} from "@spica-server/database";
import {RealtimeDatabaseService} from "@spica-server/database/realtime";
import {ChunkKind} from "@spica-server/interface/realtime";
import {GuardService} from "@spica-server/passport";
import {resourceFilterFunction} from "@spica-server/passport/guard";
import {Action} from "@spica-server/interface/activity";
import {IAuthResolver, AUTH_RESOLVER} from "@spica-server/interface/bucket/common";
import {MessageKind} from "@spica-server/interface/bucket/realtime";
import {BucketDocument} from "@spica-server/interface/bucket";
import {getConnectionHandlers} from "@spica-server/realtime";
@WebSocketGateway({
  path: "/bucket/:id/data"
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  constructor(
    private realtime: RealtimeDatabaseService,
    private guardService: GuardService,
    private bucketService: BucketService,
    private bucketDataService: BucketDataService,
    private validator: Validator,
    @Inject(AUTH_RESOLVER) private authResolver: IAuthResolver,
    @Optional() private activity: ActivityService,
    @Optional() private history: HistoryService,
    @Optional() private hookEmitter: ChangeEmitter,
    @Optional() private bucketCacheService: BucketCacheService
  ) {
    this.handlers = getConnectionHandlers(
      this.guardService,
      this.getCollectionName.bind(this),
      this.getFindOptions.bind(this),
      error => ({
        kind: ChunkKind.Error,
        status: error.status || 500,
        message: error.message || "Unexpected error"
      }),
      this.realtime,
      resourceFilterFunction,
      "bucket:data:stream"
    );
  }

  private handlers: {
    handleConnection: (client: any, req: any) => Promise<void>;
    handleDisconnect: (client: any, req: any) => Promise<void>;
  };

  private async getCollectionName(client, req): Promise<string> {
    const {schemaId} = await this.prepareClient(client, req);
    return getBucketDataCollection(schemaId);
  }

  private async getFindOptions(client, req): Promise<any> {
    const {options} = await this.prepareClient(client, req);
    return options;
  }

  async handleConnection(client: any, req: any) {
    return this.handlers.handleConnection(client, req);
  }

  async handleDisconnect(client: any) {
    return this.handlers.handleDisconnect(client, client.upgradeReq);
  }

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

    req.resourceFilter = resourceFilterFunction({}, {
      switchToHttp: () => {
        return {
          getRequest: () => req
        };
      }
    } as any);
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

    let insertedDoc;

    try {
      insertedDoc = await insertDocument(
        schema,
        document,
        {req: client.upgradeReq},
        {
          collection: schema => this.bucketDataService.children(schema),
          schema: this.getBucketResolver(),
          deleteOne: id => this.delete(client, {_id: id}),
          authResolver: this.authResolver
        }
      );
    } catch (error) {
      return this.send(client, ChunkKind.Response, error.status || 500, error.message);
    }

    if (this.hookEmitter) {
      this.hookEmitter.emitChange(
        {
          bucket: schema._id.toString(),
          type: "insert"
        },
        insertedDoc._id.toString(),
        undefined,
        insertedDoc
      );
    }

    if (this.bucketCacheService) {
      this.bucketCacheService.invalidate(schema._id.toString());
    }

    if (this.activity) {
      insertActivity(
        client.upgradeReq,
        Action.POST,
        schema._id.toString(),
        insertedDoc._id.toString(),
        this.activity
      );
    }

    return this.send(client, ChunkKind.Response, 201, "Created");
  }

  @SubscribeMessage(MessageKind.REPLACE)
  async replace(client: any, document: BucketDocument) {
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

    let previousDocument;

    try {
      previousDocument = await replaceDocument(
        schema,
        {...document, _id: documentId},
        {req: client.upgradeReq},
        {
          collection: schema => this.bucketDataService.children(schema),
          schema: this.getBucketResolver(),
          authResolver: this.authResolver
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
        `Could not find the document with id ${documentId.toString()}`
      );
    }

    if (this.hookEmitter) {
      this.hookEmitter.emitChange(
        {
          bucket: schema._id.toString(),
          type: "update"
        },
        documentId.toString(),
        previousDocument,
        document
      );
    }

    if (this.bucketCacheService) {
      this.bucketCacheService.invalidate(schema._id.toString());
    }

    if (this.history && schema.history) {
      this.history.createHistory(schema._id, previousDocument, {
        ...document,
        _id: documentId
      });
    }

    if (this.activity) {
      insertActivity(
        client.upgradeReq,
        Action.PUT,
        schema._id.toString(),
        documentId.toString(),
        this.activity
      );
    }

    return this.send(client, ChunkKind.Response, 200, "OK");
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

    const previousDocument = await this.bucketDataService
      .children(schema)
      .findOne({_id: documentId});

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

    let currentDocument;

    try {
      currentDocument = await patchDocument(
        schema,
        {...patchedDocument, _id: documentId},
        document,
        {req: client.upgradeReq},
        {
          collection: schema => this.bucketDataService.children(schema),
          schema: this.getBucketResolver(),
          authResolver: this.authResolver
        },
        {returnDocument: ReturnDocument.AFTER}
      );
    } catch (error) {
      return this.send(client, ChunkKind.Response, error.status || 500, error.message);
    }

    if (!currentDocument) {
      return this.send(
        client,
        ChunkKind.Response,
        404,
        `Could not find the document with id ${documentId.toString()}`
      );
    }

    if (this.hookEmitter) {
      this.hookEmitter.emitChange(
        {
          bucket: schema._id.toString(),
          type: "update"
        },
        documentId.toString(),
        previousDocument,
        currentDocument
      );
    }

    if (this.bucketCacheService) {
      this.bucketCacheService.invalidate(schema._id.toString());
    }

    if (this.history && schema.history) {
      this.history.createHistory(schema._id, previousDocument, currentDocument);
    }

    if (this.activity) {
      insertActivity(
        client.upgradeReq,
        Action.PUT,
        schema._id.toString(),
        documentId.toString(),
        this.activity
      );
    }

    return this.send(client, ChunkKind.Response, 204, "No Content");
  }

  @SubscribeMessage(MessageKind.DELETE)
  async delete(client: any, document: any) {
    let schema;

    try {
      schema = await this.extractSchema(client);
    } catch (error) {
      return;
    }

    if (!ObjectId.isValid(document._id)) {
      return this.send(client, ChunkKind.Response, 400, `${document._id} is an invalid object id`);
    }

    let deletedDocument;

    try {
      deletedDocument = await deleteDocument(
        schema,
        document._id,
        {req: client.upgradeReq},
        {
          collection: schema => this.bucketDataService.children(schema),
          schema: this.getBucketResolver(),
          authResolver: this.authResolver
        }
      );
    } catch (error) {
      return this.send(client, ChunkKind.Response, 500, error.message);
    }

    if (!deletedDocument) {
      return this.send(
        client,
        ChunkKind.Response,
        404,
        `Could not find the document with id ${document._id.toString()}`
      );
    }

    if (this.hookEmitter) {
      this.hookEmitter.emitChange(
        {
          bucket: schema._id.toString(),
          type: "delete"
        },
        document._id.toString(),
        deletedDocument,
        undefined
      );
    }

    if (this.bucketCacheService) {
      this.bucketCacheService.invalidate(schema._id.toString());
    }

    if (this.history) {
      this.history.deleteMany({
        document_id: new ObjectId(document._id)
      });
    }

    if (this.activity) {
      insertActivity(
        client.upgradeReq,
        Action.DELETE,
        schema._id.toString(),
        document._id.toString(),
        this.activity
      );
    }
    clearRelations(this.bucketService, schema._id, document._id);

    const dependents = getDependents(schema, deletedDocument);

    for (const [targetBucketId, targetDocIds] of dependents.entries()) {
      for (const targetDocId of targetDocIds) {
        const targetClient = deepCopy(client);
        targetClient.__mock_client__ = true;

        const targetReq = deepCopy(client.upgradeReq);

        targetReq.params.id = targetBucketId;

        const targetDoc = {
          _id: targetDocId
        };

        this.delete(targetClient, targetDoc);
      }
    }
    return this.send(client, ChunkKind.Response, 204, "No Content");
  }

  validateDocument(schemaId: string, document: any): Promise<void> {
    const ValidatorMixin = Schema.validate(schemaId);
    const validationPipe: any = new ValidatorMixin(this.validator);

    return validationPipe.transform(document);
  }

  async prepareClient(client, req): Promise<{schemaId: string; options: any}> {
    const schemaId = req.params.id;

    if (!ObjectId.isValid(schemaId)) {
      this.send(client, ChunkKind.Error, 400, `${schemaId} is not a valid object id.`);
      return client.close(1003);
    }

    const schema = await this.bucketService.findOne({_id: new ObjectId(schemaId)});

    if (!schema) {
      this.send(client, ChunkKind.Error, 400, `Could not find the schema with id ${schemaId}.`);
      return client.close(1003);
    }

    const options: any = {filter: {$and: []}};

    const policyMatch = req.resourceFilter || {$match: {}};
    options.filter.$and.push(policyMatch.$match);

    req = authIdToString(req);
    const ruleMatch = expression.aggregate(schema.acl.read, {auth: req.user}, "match");
    options.filter.$and.push(ruleMatch);

    let filter = req.query.get("filter");

    if (filter) {
      let parsedFilter = parseFilter((value: string) => JSON.parse(value, filterReviver), filter);

      if (parsedFilter) {
        parsedFilter = await constructFilterValues(parsedFilter, schema, this.getBucketResolver());
      } else if (!parsedFilter) {
        parsedFilter = parseFilter(aggregate, filter, {}, "match");
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

      options.filter.$and.push(parsedFilter);
    }

    if (req.query.has("sort")) {
      try {
        options.sort = JSON.parse(req.query.get("sort"));
      } catch (e) {
        this.send(client, ChunkKind.Error, e.status, e.message);
        return client.close(1003);
      }
    }

    if (req.query.has("limit")) {
      options.limit = Number(req.query.get("limit"));
    }

    if (req.query.has("skip")) {
      options.skip = Number(req.query.get("skip"));
    }

    return {options, schemaId};
  }

  extractSchema(client: any): Promise<any> {
    return new Promise(async (resolve, reject) => {
      await this.prepareClient(client, client.upgradeReq);

      try {
        await this.authorize(client.upgradeReq, client);
      } catch (error) {
        this.send(client, ChunkKind.Error, error.status, error.message);
        client.close(1003);
        reject();
      }

      if (!ObjectId.isValid(client.upgradeReq.params.id)) {
        this.send(
          client,
          ChunkKind.Error,
          400,
          `${client.upgradeReq.params.id} is an invalid object id.`
        );
        client.close(1003);
      }

      const schemaId = new ObjectId(client.upgradeReq.params.id);

      const schema = await this.bucketService.findOne({_id: schemaId});

      if (!schema) {
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

  getBucketResolver() {
    return (id: string | ObjectId) => this.bucketService.findOne({_id: new ObjectId(id)});
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
