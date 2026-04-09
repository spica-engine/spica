import {Inject, Optional} from "@nestjs/common";
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway
} from "@nestjs/websockets";
import {ActivityService} from "@spica-server/activity-services";
import {BucketCacheService} from "@spica-server/bucket-cache";
import {
  insertDocument,
  insertActivity,
  replaceDocument,
  patchDocument,
  deleteDocument,
  clearRelations,
  getDependents,
  applyFieldLevelAcl,
  decryptDocumentFields
} from "@spica-server/bucket-common";
import {HistoryService} from "@spica-server/bucket-history";
import {ChangeEmitter} from "@spica-server/bucket-hooks";
import {
  BucketService,
  getBucketDataCollection,
  BucketDataService
} from "@spica-server/bucket-services";
import {applyPatch, deepCopy} from "@spica-server/core-patch";
import {Schema, Validator} from "@spica-server/core-schema";
import {ObjectId, ReturnDocument} from "@spica-server/database";
import {RealtimeDatabaseService} from "@spica-server/database-realtime";
import {ChunkKind} from "@spica-server/interface-realtime";
import {GuardService} from "@spica-server/passport-guard-services";
import {extractStrategyType} from "@spica-server/passport-guard";
import {Action} from "@spica-server/interface-activity";
import {MessageKind} from "@spica-server/interface-bucket-realtime";
import {
  Bucket,
  BucketDocument,
  BUCKET_DATA_ENCRYPTION_SECRET,
  BUCKET_DATA_HASH_SECRET
} from "@spica-server/interface-bucket";
import {getConnectionHandlers} from "@spica-server/realtime";
import {ReqAuthStrategy} from "@spica-server/interface-passport-guard";
import {BucketDataOptionsBuilder} from "./bucket-data-options.builder.js";

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
    @Optional() private activity: ActivityService,
    @Optional() private history: HistoryService,
    @Optional() private hookEmitter: ChangeEmitter,
    @Optional() private bucketCacheService: BucketCacheService,
    @Optional() @Inject(BUCKET_DATA_HASH_SECRET) private hashSecret?: string,
    @Optional() @Inject(BUCKET_DATA_ENCRYPTION_SECRET) private encryptionSecret?: string
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
      undefined,
      "bucket:data:stream",
      [
        (_client: any, req: any) => (data: any) => this.applyAcl(data, req),
        ...(this.encryptionSecret ? [this.decryptDocuments.bind(this)] : [])
      ]
    );
  }

  private handlers: {
    handleConnection: (client: any, req: any) => Promise<void>;
    handleDisconnect: (client: any, req: any) => Promise<void>;
  };

  private async getCollectionName(_client, req): Promise<string> {
    const schemaId = req.params.id;

    if (!ObjectId.isValid(schemaId)) {
      throw new Error(`${schemaId} is not a valid object id.`);
    }

    return getBucketDataCollection(schemaId);
  }

  private async getFindOptions(_client, req): Promise<any> {
    const schemaId = req.params.id;

    const schema = await this.bucketService.findOne({_id: new ObjectId(schemaId)});

    if (!schema) {
      throw new Error(`Could not find the schema with id ${schemaId}.`);
    }

    return BucketDataOptionsBuilder.fromBucketQuery(
      req,
      schema,
      this.getBucketResolver(),
      this.shouldApplyAcl(req)
    );
  }

  async handleConnection(client: any, req: any) {
    return this.handlers.handleConnection(client, req);
  }

  async handleDisconnect(client: any) {
    return this.handlers.handleDisconnect(client, client.upgradeReq);
  }

  private async authorizeAction(req: any, client: any, action: string): Promise<void> {
    await this.guardService.checkAuthentication({
      request: req,
      response: client
    });

    await this.guardService.checkAuthorization({
      request: req,
      response: client,
      actions: action,
      options: {resourceFilter: false}
    });
  }

  @SubscribeMessage(MessageKind.INSERT)
  async insert(client: any, document: any) {
    let schema: Bucket;

    try {
      schema = await this.getSchema(client);
    } catch (error) {
      return this.send(client, ChunkKind.Response, error.status || 400, error.message);
    }

    try {
      await this.authorizeAction(client.upgradeReq, client, "bucket:data:create");
    } catch (error) {
      return this.send(client, ChunkKind.Response, error.status || 403, error.message);
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
        {
          req: client.upgradeReq,
          applyAcl: this.shouldApplyAcl(client.upgradeReq)
        },
        {
          collection: schema => this.bucketDataService.children(schema),
          schema: this.getBucketResolver(),
          deleteOne: id => this.delete(client, {_id: id})
        },
        this.hashSecret,
        this.encryptionSecret
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
    let schema: Bucket;

    try {
      schema = await this.getSchema(client);
    } catch (error) {
      return this.send(client, ChunkKind.Response, error.status || 400, error.message);
    }

    try {
      await this.authorizeAction(client.upgradeReq, client, "bucket:data:update");
    } catch (error) {
      return this.send(client, ChunkKind.Response, error.status || 403, error.message);
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
        {
          req: client.upgradeReq,
          applyAcl: this.shouldApplyAcl(client.upgradeReq)
        },
        {
          collection: schema => this.bucketDataService.children(schema),
          schema: this.getBucketResolver()
        },
        undefined,
        this.hashSecret,
        this.encryptionSecret
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
    let schema: Bucket;

    try {
      schema = await this.getSchema(client);
    } catch (error) {
      return this.send(client, ChunkKind.Response, error.status || 400, error.message);
    }

    try {
      await this.authorizeAction(client.upgradeReq, client, "bucket:data:update");
    } catch (error) {
      return this.send(client, ChunkKind.Response, error.status || 403, error.message);
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
        {
          req: client.upgradeReq,
          applyAcl: this.shouldApplyAcl(client.upgradeReq)
        },
        {
          collection: schema => this.bucketDataService.children(schema),
          schema: this.getBucketResolver()
        },
        {returnDocument: ReturnDocument.AFTER},
        this.hashSecret,
        this.encryptionSecret
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
    let schema: Bucket;

    try {
      schema = await this.getSchema(client);
    } catch (error) {
      return this.send(client, ChunkKind.Response, error.status || 400, error.message);
    }

    if (!client.__mock_client__) {
      try {
        await this.authorizeAction(client.upgradeReq, client, "bucket:data:delete");
      } catch (error) {
        return this.send(client, ChunkKind.Response, error.status || 403, error.message);
      }
    }

    if (!ObjectId.isValid(document._id)) {
      return this.send(client, ChunkKind.Response, 400, `${document._id} is an invalid object id`);
    }

    let deletedDocument;

    try {
      deletedDocument = await deleteDocument(
        schema,
        document._id,
        {
          req: client.upgradeReq,
          applyAcl: this.shouldApplyAcl(client.upgradeReq)
        },
        {
          collection: schema => this.bucketDataService.children(schema),
          schema: this.getBucketResolver()
        },
        this.hashSecret,
        this.encryptionSecret
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
        try {
          const targetClient = deepCopy(client);
          targetClient.__mock_client__ = true;

          const targetReq = deepCopy(client.upgradeReq);
          targetReq.params.id = targetBucketId;
          targetClient.upgradeReq = targetReq;

          await this.delete(targetClient, {_id: targetDocId});
        } catch (error) {
          // Cascade failure should not crash the main delete operation
        }
      }
    }

    return this.send(client, ChunkKind.Response, 204, "No Content");
  }

  validateDocument(schemaId: string, document: any): Promise<void> {
    const ValidatorMixin = Schema.validate(schemaId);
    const validationPipe: any = new ValidatorMixin(this.validator);

    return validationPipe.transform(document);
  }

  private async getSchema(client: any): Promise<Bucket> {
    const schemaId = client.upgradeReq.params.id;

    if (!ObjectId.isValid(schemaId)) {
      const error: any = new Error(`${schemaId} is an invalid object id.`);
      error.status = 400;
      throw error;
    }

    const schema = await this.bucketService.findOne({_id: new ObjectId(schemaId)});

    if (!schema) {
      const error: any = new Error(`Could not find the schema with id ${schemaId}`);
      error.status = 404;
      throw error;
    }

    return schema;
  }

  getBucketResolver() {
    return (id: string | ObjectId) => this.bucketService.findOne({_id: new ObjectId(id)});
  }

  send(client, kind: ChunkKind, status: number, message: string) {
    client.send(JSON.stringify({kind, status, message}));
  }

  private shouldApplyAcl(req: any): boolean {
    const strategyType = extractStrategyType(req);
    return strategyType === ReqAuthStrategy.USER;
  }

  private async applyAcl(document: any, req: any) {
    if (!document || !this.shouldApplyAcl(req)) {
      return document;
    }

    const schema = await this.bucketService.findOne({_id: new ObjectId(req.params.id)});
    if (!schema?.properties) {
      return document;
    }

    return applyFieldLevelAcl(document, schema.properties, req.user);
  }

  private async decryptDocuments(_client: any, req: any) {
    const bucketId = req.params.id;
    const schema = await this.bucketService.findOne({_id: new ObjectId(bucketId)});
    if (!schema) return undefined;
    return (document: any) => {
      if (!document) return document;
      return decryptDocumentFields(
        document,
        schema,
        this.encryptionSecret,
        this.getBucketResolver(),
        document._id
      );
    };
  }
}
