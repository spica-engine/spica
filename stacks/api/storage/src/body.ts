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
import {Observable, OperatorFunction, PartialObserver, Subscriber, TeardownLogic} from "rxjs";
import {finalize, switchMapTo} from "rxjs/operators";
import {StorageOptions, STORAGE_OPTIONS} from "./options";
import * as multer from "multer";
import * as fs from "fs";
// import { Express } from 'express'
// import { Multer } from 'multer';

// decide whether it should be abstract
class __BaseBody {
  payloadSizeError: HttpException;
  limit: number;

  constructor(public options: StorageOptions) {
    this.payloadSizeError = new HttpException(
      `maximum object size is ${this.options.objectSizeLimit}Mi`,
      HttpStatus.PAYLOAD_TOO_LARGE
    );

    this.limit = this.options.objectSizeLimit * 1024 * 1024;
  }

  isLimitExceeded(req) {
    return Number(req.headers["content-length"]) > this.limit;
  }

  handleParseError(error, observer) {
    if (error.type == "entity.too.large") {
      return observer.error(this.payloadSizeError);
    }
    return observer.error(error);
  }

  buildInterceptor(
    beforeHandleSubscriber: (subscriber: Subscriber<any>) => TeardownLogic,
    next: CallHandler,
    afterHandleOperator?: OperatorFunction<any, any>
  ) {
    let obs = new Observable(beforeHandleSubscriber).pipe(switchMapTo(next.handle()));
    if (afterHandleOperator) {
      obs = obs.pipe(afterHandleOperator);
    }

    return obs;
  }

  completeObserver(observer) {
    observer.next();
    observer.complete();
  }
}

// minimize copy-paste code
abstract class __MultipartFormDataBody extends __BaseBody {
  constructor(@Inject(STORAGE_OPTIONS) public options: StorageOptions) {
    super(options);
  }

  isContentTypeValid(req) {
    return req.headers["content-type"].startsWith("multipart/form-data");
  }

  fileCleanup(context: ExecutionContext) {
    const [req] = context.getArgs();
    if (this.isContentTypeValid(req)) {
      return Promise.all(req.body.map(b => fs.promises.unlink(b.path)));
    }
    return Promise.resolve();
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const [req, res] = context.getArgs();
    const beforeHandleSubscriber = observer => {
      if (this.isLimitExceeded(req)) {
        return observer.error(this.payloadSizeError);
      }

      if (!this.isContentTypeValid(req)) {
        this.completeObserver(observer);
        return;
      }

      const parser = multer({
        dest: this.options.defaultPath
      }).array("files");

      parser(req, res, error => {
        if (error) {
          return this.handleParseError(error, observer);
        }

        req.body = req.files;

        this.completeObserver(observer);
      });
    };

    const afterHandleOperator = finalize(() =>
      // i think multer(or we) still tries to open file, put the cleanup task to the end
      // it happens for only error cases
      setImmediate(() => this.fileCleanup(context))
    );

    return this.buildInterceptor(beforeHandleSubscriber, next, afterHandleOperator);
  }
}

abstract class __BsonBody extends __BaseBody {
  constructor(@Inject(STORAGE_OPTIONS) public options: StorageOptions) {
    super(options);
  }

  isContentTypeValid(req) {
    return req.headers["content-type"] == "application/bson";
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const [req, res] = context.getArgs();

    const beforeHandleSubscriber = observer => {
      if (this.isLimitExceeded(req)) {
        return observer.error(this.payloadSizeError);
      }

      if (!this.isContentTypeValid(req)) {
        this.completeObserver(observer);
        return;
      }

      const parser = raw({
        type: "application/bson",
        limit: this.limit
      });

      parser(req, res, error => {
        if (error) {
          return this.handleParseError(error, observer);
        }

        try {
          req.body = deserialize(req.body, {promoteBuffers: true});
        } catch (error) {
          return observer.error(error);
        }
      });
    };

    return this.buildInterceptor(beforeHandleSubscriber, next);
  }
}

abstract class __JsonBody extends __BaseBody {
  constructor(@Inject(STORAGE_OPTIONS) public options: StorageOptions) {
    super(options);
  }

  isContentTypeValid(req) {
    return req.headers["content-type"] != "application/json";
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const [req, res] = context.getArgs();

    const beforeHandleSubscriber = observer => {
      if (this.isLimitExceeded(req)) {
        return observer.error(this.payloadSizeError);
      }

      if (!this.isContentTypeValid(req)) {
        return this.completeObserver(observer);
      }

      const parser = json({
        limit: this.limit
      });

      parser(req, res, error => {
        if (error) {
          return this.handleParseError(error, observer);
        }

        this.completeObserver(observer);
      });
    };

    return this.buildInterceptor(beforeHandleSubscriber, next);
  }
}

export function BsonBodyParser(): Type<any> {
  return mixin(class extends __BsonBody {});
}

export function JsonBodyParser(): Type<any> {
  return mixin(class extends __JsonBody {});
}

export function MultipartFormDataParser(): Type<any> {
  return mixin(class extends __MultipartFormDataBody {});
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

// multer library overrides the global express object
//@ts-ignore
export type MultipartFormData = Express.Multer.File[];

export type MixedBody = BsonBody | JsonBody | MultipartFormData;

export function isJsonBody(object: unknown): object is JsonBody {
  return Array.isArray(object);
}

// write a better check here.
export function isMultipartFormDataBody(object: unknown): object is MultipartFormData {
  return Array.isArray(object) && Object.keys(object[0]).includes("originalname");
}

export function isBsonBody(object: unknown): object is BsonBody {
  return object && Array.isArray((<BsonBody>object).content);
}
