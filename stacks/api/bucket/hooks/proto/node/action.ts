import {Action} from "@spica-server/bucket/hooks/proto";

export class ActionParameters {
  bucket: string;
  document: string;
  headers: object;
  type: string;
  constructor(parameters: Action.Action) {
    this.bucket = parameters.bucket;
    this.document = parameters.document;
    this.type = Action.Action.Type[parameters.type];
    this.headers = {};
    if (parameters.headers.length > 0)
      parameters.headers.forEach(header => {
        this.headers[header.key] = header.value;
      });
  }
}
