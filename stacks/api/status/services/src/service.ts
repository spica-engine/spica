import {BaseCollection, DatabaseService} from "@spica-server/database";
import {Inject, Injectable} from "@nestjs/common";
import {ApiStatus, StatusOptions, STATUS_OPTIONS} from "./interface";

@Injectable()
export class StatusService extends BaseCollection<ApiStatus>("status") {
  moduleOptions: StatusOptions;
  constructor(db: DatabaseService, @Inject(STATUS_OPTIONS) _moduleOptions: StatusOptions) {
    // this service will insert document for each request, enabling entry limit feature here will increase request-response time.
    // we will apply entry limitation from somewhere else
    super(db);
    this.createCollection(this._collection, {ignoreAlreadyExist: true}).then(() =>
      this.upsertTTLIndex(_moduleOptions.expireAfterSeconds)
    );

    this.moduleOptions = _moduleOptions;
  }

  getTransferredSize(parent: "request" | "response") {
    const field = `${parent}.size`;
    return super
      .aggregate([
        {
          $group: {
            _id: null,
            total: {$sum: `$${field}`}
          }
        },
        {
          $project: {total: 1}
        }
      ])
      .toArray()
      .then((d: any) => (d.length ? d[0].total : 0));
  }

  private byteToMb(bytes: number) {
    return parseFloat((bytes * Math.pow(10, -6)).toFixed(2));
  }

  async _getStatus() {
    const currentDocsLength = await super.estimatedDocumentCount();
    return {
      requests: {
        limit: this.moduleOptions ? this.moduleOptions.requestLimit : undefined,
        current: currentDocsLength,
        unit: "count"
      },
      uploaded: {
        current: await this.getTransferredSize("request").then(bytes => this.byteToMb(bytes)),
        unit: "mb"
      },
      responses: {
        limit: this.moduleOptions ? this.moduleOptions.requestLimit : undefined,
        current: currentDocsLength,
        unit: "count"
      },
      downloaded: {
        current: await this.getTransferredSize("response").then(bytes => this.byteToMb(bytes)),
        unit: "mb"
      }
    };
  }
}
