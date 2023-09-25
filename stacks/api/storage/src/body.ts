import {
  BadRequestException,
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
  isArray: boolean;

  constructor(@Inject(STORAGE_OPTIONS) public options: StorageOptions) {
    super(options);
  }

  isContentTypeValid(req) {
    return req.headers["content-type"].startsWith("multipart/form-data");
  }

  fileCleanup(context: ExecutionContext) {
    const [req] = context.getArgs();
    if (this.isContentTypeValid(req)) {
      const files = this.isArray ? req.body : [req.body];
      return Promise.all(files.map(b => fs.promises.unlink(b.path)));
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

      const multerObj = multer({
        dest: this.options.defaultPath,
        fileFilter(req, file, callback) {
          file.originalname = decodeURIComponent(file.originalname);
          callback(null, true);
        }
      });

      let parser;
      if (this.isArray) {
        parser = multerObj.array("files");
      } else {
        parser = multerObj.single("file");
      }

      parser(req, res, error => {
        if (error) {
          return this.handleParseError(error, observer);
        }

        req.body = this.isArray ? req.files : req.file;

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

        this.completeObserver(observer);
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

export function MultipartFormDataParser(options: {isArray: boolean}): Type<any> {
  return mixin(
    class extends __MultipartFormDataBody {
      isArray: boolean = options.isArray;
    }
  );
}

export interface StorageObject<DataType> {
  _id?: string | ObjectId;
  name: string;
  url?: string;
  content: StorageObjectContent<DataType>;
}

export interface StorageObjectContent<DataType> {
  data: DataType;
  type: string;
  size?: number;
}

export type StorageObjectContentMeta = Omit<StorageObjectContent<any>, "data">;

export type StorageObjectMeta = Omit<StorageObject<any>, "content"> & {
  content: StorageObjectContentMeta;
};

export interface BsonArray {
  content: StorageObject<Buffer>[];
}

export type JsonArray = StorageObject<Buffer>[];

export type MultipartFormData = Express.Multer.File;

export type MixedBody = BsonArray | JsonArray | MultipartFormData[];

export function isMultipartFormDataArray(object: unknown): object is MultipartFormData[] {
  return Array.isArray(object) && isMultipartFormData(object[0]);
}

export function isMultipartFormData(object: unknown): object is MultipartFormData {
  return Object.keys(object).includes("originalname");
}

export function isBufferContent(body): body is StorageObject<Buffer> {
  return body.content && body.content.data instanceof Buffer;
}

export function multipartToStorageObject(object: MultipartFormData): StorageObject<fs.ReadStream> {
  return {
    name: object.originalname,
    content: {
      type: object.mimetype,
      data: fs.createReadStream(object.path),
      size: object.size
    }
  };
}

export function addContentSize(object: StorageObject<Buffer>) {
  object.content.size = object.content.data.byteLength;
  return object;
}

interface IBodyConverter<I, O> {
  validate: (body: unknown) => boolean;
  convert: (body: I) => O;
}

const MultipartConverter: IBodyConverter<MultipartFormData, StorageObject<fs.ReadStream>> = {
  validate: (body: unknown) => isMultipartFormData(body),
  convert: (body: MultipartFormData) => multipartToStorageObject(body)
};

const MultipartArrayConverter: IBodyConverter<
  MultipartFormData[],
  StorageObject<fs.ReadStream>[]
> = {
  validate: (body: MixedBody) => {
    return (
      body && Array.isArray(body) && (body as unknown[]).every(b => MultipartConverter.validate(b))
    );
  },
  convert: (body: MultipartFormData[]) => body.map(object => MultipartConverter.convert(object))
};

const BsonConverter: IBodyConverter<StorageObject<Buffer>, StorageObject<Buffer>> = {
  validate: (body: unknown) => isBufferContent(body),
  convert: (body: StorageObject<Buffer>) => addContentSize(body)
};

const JsonConverter = BsonConverter;

const BsonArrayConverter: IBodyConverter<BsonArray, StorageObject<Buffer>[]> = {
  validate: (body: MixedBody) => {
    return (
      body &&
      Array.isArray((<BsonArray>body).content) &&
      (<BsonArray>body).content.every(o => BsonConverter.validate(o))
    );
  },
  convert: (body: BsonArray) => {
    return body.content.map(object => BsonConverter.convert(object));
  }
};

const JsonArrayConverter: IBodyConverter<JsonArray, StorageObject<Buffer>[]> = {
  validate: (body: MixedBody) => {
    return body && Array.isArray(body) && (body as unknown[]).every(o => JsonConverter.validate(o));
  },
  convert: (body: JsonArray) => {
    return body.map(object => JsonConverter.convert(object));
  }
};

const postConverters: IBodyConverter<
  MultipartFormData[] | BsonArray | JsonArray,
  StorageObject<fs.ReadStream | Buffer>[]
>[] = [MultipartArrayConverter, BsonArrayConverter, JsonArrayConverter];

const putConverters: IBodyConverter<
  MultipartFormData | StorageObject<Buffer>,
  StorageObject<fs.ReadStream | Buffer>
>[] = [MultipartConverter, BsonConverter, JsonConverter];

export function getPostBodyConverter(body: MixedBody) {
  return postConverters.find(c => c.validate(body));
}

export function getPutBodyConverter(body: MultipartFormData | StorageObject<Buffer>) {
  return putConverters.find(c => c.validate(body));
}
