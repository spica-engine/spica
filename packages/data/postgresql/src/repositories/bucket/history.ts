import {Inject, Injectable} from "@nestjs/common";
import {gte, Orm} from "@spica-server/data-postgresql-orm";
import {diff, schemaDiff} from "@spica-server/core-differ";
import {Bucket, BucketDocument} from "@spica-server/interface-bucket";
import {BUCKET_QUERY, BucketQueryFacade} from "@spica-server/interface-bucket-common";
import {History, HistoryRepository, HistorySummary} from "@spica-server/interface-bucket-history";
import {ChangeKind, ChangePaths} from "@spica-server/interface-core";
import {Id} from "@spica-server/interface-data";
import {histories} from "../../entities/index.js";
import {ORM} from "../../orm.js";
import {keyedReadContext} from "./read-context.js";
import {StoredBuckets} from "./stored-buckets.js";
import {idOf} from "@spica-server/data";

const MAX_HISTORIES_PER_DOCUMENT = 10;

@Injectable()
export class PostgresHistoryRepository implements HistoryRepository {
  constructor(
    @Inject(ORM) private readonly orm: Orm,
    @Inject(BUCKET_QUERY) private readonly query: BucketQueryFacade
  ) {}

  async updateHistories(previousSchema: Bucket, currentSchema: Bucket) {
    const paths = schemaDiff(previousSchema, currentSchema)
      .filter(
        ({lastPath, path, kind}) =>
          path.length > 0 &&
          (kind == ChangeKind.Delete ||
            (kind == ChangeKind.Edit &&
              (lastPath[0] == "bucket" ||
                lastPath[0] == "relationType" ||
                lastPath[0] == "type" ||
                (lastPath[0] == "options" && lastPath[1] == "translate"))))
      )
      .map(change => change.path);

    if (!paths.length) {
      return;
    }

    await this.orm.transaction(async session => {
      const stored = await session.findMany(
        histories,
        {bucket_id: idOf(currentSchema)},
        {orderBy: {_id: "asc"}, lock: "update"}
      );

      for (const history of stored) {
        const kept = (history.changes ?? []).filter(
          change => !paths.some(path => startsWith(change.path, path))
        );
        if (!kept.length) {
          await session.deleteById(histories, idOf(history));
        } else if (kept.length != history.changes?.length) {
          await session.updateById(histories, idOf(history), {changes: kept});
        }
      }
    });
  }

  async createHistory(
    bucketId: Id,
    documentId: Id,
    previousDocument: BucketDocument,
    currentDocument: BucketDocument
  ) {
    const changes = diff(currentDocument, previousDocument);
    if (!changes.length) {
      return;
    }

    return this.orm.transaction(async session => {
      await session.lockTransaction(`history:${bucketId}:${String(documentId)}`);
      const stale = await session.findMany(
        histories,
        {bucket_id: bucketId, document_id: String(documentId)},
        {select: ["_id"], orderBy: {_id: "desc"}, offset: MAX_HISTORIES_PER_DOCUMENT - 1}
      );
      if (stale.length) {
        await session.deleteWhere(histories, {_id: stale.map(history => idOf(history))});
      }
      return session.insert(histories, {
        bucket_id: bucketId,
        document_id: String(documentId) as unknown as Id,
        changes
      });
    });
  }

  async getDocument(bucketId: Id, documentId: Id): Promise<BucketDocument | null> {
    const bucket = await new StoredBuckets(this.orm).find(bucketId);
    if (!bucket) {
      return null;
    }
    const {result} = await this.query.findOne<BucketDocument>(
      bucket,
      {documentId},
      keyedReadContext
    );
    return result ?? null;
  }

  async findSummaries(bucketId: Id, documentId: Id) {
    const found = await this.orm.findMany(
      histories,
      {bucket_id: bucketId, document_id: String(documentId)},
      {select: ["_id", "created_at", "changes"], orderBy: {_id: "desc"}}
    );
    return found.map(history => ({
      _id: idOf(history),
      date: history.created_at,
      changes: history.changes?.length ?? 0
    })) as HistorySummary[];
  }

  findSince(bucketId: Id, documentId: Id, historyId: Id) {
    return this.orm.findMany(
      histories,
      {bucket_id: bucketId, document_id: String(documentId), _id: gte(historyId)},
      {orderBy: {_id: "desc"}}
    ) as Promise<History[]>;
  }

  async deleteByBucket(bucketId: Id) {
    return await this.orm.deleteWhere(histories, {bucket_id: bucketId});
  }

  async deleteByDocument(documentId: Id) {
    return await this.orm.deleteWhere(histories, {document_id: String(documentId)});
  }
}

function startsWith(path: ChangePaths | undefined, prefix: ChangePaths) {
  return (
    !!path &&
    path.length >= prefix.length &&
    prefix.every((segment, index) =>
      (segment as unknown) instanceof RegExp
        ? typeof path[index] == "number"
        : path[index] === segment
    )
  );
}
