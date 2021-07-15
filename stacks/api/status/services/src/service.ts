import {BaseCollection, DatabaseService} from "@spica-server/database";
import {Inject, Injectable} from "@nestjs/common";
import {ApiStatus, StatusOptions, STATUS_OPTIONS} from "./interface";

@Injectable()
export class StatusService extends BaseCollection<ApiStatus>("status") {
  moduleOptions: StatusOptions;
  constructor(db: DatabaseService, @Inject(STATUS_OPTIONS) _moduleOptions: StatusOptions) {
    // this service will insert document for each request, enabling entry limit feature here will cause to slow requests,responses
    // we will apply entry limitation from somewhere else
    super(db);
    this.createCollection(this._collection, {ignoreAlreadyExist: true}).then(() =>
      this.upsertTTLIndex(_moduleOptions.expireAfterSeconds)
    );

    this.moduleOptions = _moduleOptions;
  }

  getTrasferredSize(parent: "request" | "response") {
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

  async _getStatus() {
    const currentDocsLength = await super.estimatedDocumentCount();
    return {
      requests: {
        limit: this.moduleOptions ? this.moduleOptions.requestLimit : undefined,
        current: currentDocsLength,
        unit: "count"
      },
      uploaded: {
        current: await this.getTrasferredSize("request"),
        unit: "mb"
      },
      responses: {
        limit: this.moduleOptions ? this.moduleOptions.requestLimit : undefined,
        current: await super.estimatedDocumentCount(),
        unit: "count"
      },
      downloaded: {
        current: await this.getTrasferredSize("response"),
        unit: "mb"
      }
    };
  }
}
