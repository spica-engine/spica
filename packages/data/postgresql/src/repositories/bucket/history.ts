import {Inject, Injectable} from "@nestjs/common";
import {gte, Orm} from "@spica-server/data-postgresql-orm";
import {diff, schemaDiff} from "@spica-server/core-differ";
import {Bucket, BucketDocument} from "@spica-server/interface-bucket";
import {History, HistoryRepository, HistorySummary} from "@spica-server/interface-bucket-history";
import {ChangeKind, ChangePaths} from "@spica-server/interface-core";
import {Id} from "@spica-server/interface-data";
import {histories} from "../../entities/index.js";
import {ORM} from "../../orm.js";

const MAX_HISTORIES_PER_DOCUMENT = 10;

@Injectable()
export class PostgresHistoryRepository implements HistoryRepository {
  constructor(@Inject(ORM) private readonly orm: Orm) {}

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
        {bucket_id: currentSchema._id},
        {orderBy: {_id: "asc"}, lock: "update"}
      );

      for (const history of stored) {
        const kept = (history.changes ?? []).filter(
          change => !paths.some(path => startsWith(change.path, path))
        );
        if (!kept.length) {
          await session.deleteById(histories, history._id);
        } else if (kept.length != history.changes?.length) {
          await session.updateById(histories, history._id, {changes: kept});
        }
      }
    });
  }

  async createHistory(
    bucketId: Id,
    previousDocument: BucketDocument,
    currentDocument: BucketDocument
  ) {
    const changes = diff(currentDocument, previousDocument);
    if (!changes.length) {
      return;
    }

    const documentId = String(currentDocument._id);
    return this.orm.transaction(async session => {
      await session.lockTransaction(`history:${bucketId}:${documentId}`);
      const stale = await session.findMany(
        histories,
        {bucket_id: bucketId, document_id: documentId},
        {select: ["_id"], orderBy: {_id: "desc"}, offset: MAX_HISTORIES_PER_DOCUMENT - 1}
      );
      if (stale.length) {
        await session.deleteWhere(histories, {_id: stale.map(history => history._id)});
      }
      return session.insert(histories, {
        bucket_id: bucketId,
        document_id: currentDocument._id,
        changes
      });
    });
  }

  async getDocument(_bucketId: Id, _documentId: Id): Promise<BucketDocument | null> {
    throw new Error("Bucket documents are not stored on PostgreSQL yet.");
  }

  async findSummaries(bucketId: Id, documentId: Id) {
    const found = await this.orm.findMany(
      histories,
      {bucket_id: bucketId, document_id: String(documentId)},
      {select: ["_id", "created_at", "changes"], orderBy: {_id: "desc"}}
    );
    return found.map(history => ({
      _id: history._id,
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
