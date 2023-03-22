import {
  CallHandler,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
  mixin,
  Type
} from "@nestjs/common";
import {ObjectId} from "@spica-server/database";
import {raw, json} from "body-parser";
import {deserialize} from "bson";
import {Observable} from "rxjs";
import {switchMapTo} from "rxjs/operators";
import {StorageOptions, STORAGE_OPTIONS} from "./options";

abstract class __BsonBody {
  constructor(@Inject(STORAGE_OPTIONS) public options: StorageOptions) {}
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const [req, res] = context.getArgs();
    return new Observable(observer => {
      const limit = this.options.objectSizeLimit * 1024 * 1024;
      const parser = raw({
        type: "application/bson",
        limit
      });

      const payloadSizeError = new HttpException(
        `maximum object size is ${this.options.objectSizeLimit}Mi`,
        HttpStatus.PAYLOAD_TOO_LARGE
      );

      if (Number(req.headers["content-length"]) > limit) {
        return observer.error(payloadSizeError);
      }

      parser(req, res, error => {
        if (error) {
          if (error.type == "entity.too.large") {
            return observer.error(payloadSizeError);
          }
          return observer.error(error);
        }
        if (req.headers["content-type"] == "application/bson") {
          try {
            req.body = deserialize(req.body, {promoteBuffers: true});
          } catch (error) {
            return observer.error(error);
          }
        }
        observer.next();
        observer.complete();
      });
    }).pipe(switchMapTo(next.handle()));
  }
}

abstract class __JsonBody {
  constructor(@Inject(STORAGE_OPTIONS) public options: StorageOptions) {}
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const [req, res] = context.getArgs();

    return new Observable(observer => {
      const limit = this.options.objectSizeLimit * 1024 * 1024;
      const parser = json({
        limit
      });

      const payloadSizeError = new HttpException(
        `maximum object size is ${this.options.objectSizeLimit}Mi`,
        HttpStatus.PAYLOAD_TOO_LARGE
      );

      if (Number(req.headers["content-length"]) > limit) {
        return observer.error(payloadSizeError);
      }

      parser(req, res, error => {
        if (error) {
          if (error.type == "entity.too.large") {
            return observer.error(payloadSizeError);
          }
          return observer.error(error);
        }
        observer.next();
        observer.complete();
      });
    }).pipe(switchMapTo(next.handle()));
  }
}

export function BsonBodyParser(): Type<any> {
  return mixin(class extends __BsonBody {});
}

export function JsonBodyParser(): Type<any> {
  return mixin(class extends __JsonBody {});
}

export interface StorageObject<DataType = Buffer> {
  _id?: string | ObjectId;
  name: string;
  url?: string;
  content: StorageObjectContent<DataType>;
}

export interface StorageObjectContent<DataType = Buffer> {
  data: DataType;
  type: string;
  size?: number;
}

export interface BsonBody {
  content: StorageObject<Buffer>[];
}

export type JsonBody = StorageObject<Buffer>[];

export type MixedBody = BsonBody | JsonBody;

export function isJsonBody(object: unknown): object is JsonBody {
  return Array.isArray(object);
}

export function isBsonBody(object: unknown): object is BsonBody {
  return object && Array.isArray((<BsonBody>object).content);
}
