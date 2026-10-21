import {
  createParamDecorator,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  mixin,
  PipeTransform,
  Type
} from "@nestjs/common";
import {Id, ID_TYPES, IdType, IdTypes} from "@spica-server/interface-data";

function parseOrReject(idType: IdType, value: unknown): Id {
  if (!value) {
    throw new HttpException("Invalid id.", HttpStatus.BAD_REQUEST);
  }
  try {
    return idType.parse(value);
  } catch {
    throw new HttpException("Invalid id.", HttpStatus.BAD_REQUEST);
  }
}

export function ID(collection: string): Type<PipeTransform<unknown, Id>> {
  @Injectable()
  class IdPipe implements PipeTransform<unknown, Id> {
    constructor(@Inject(ID_TYPES) private readonly idTypes: IdTypes) {}

    transform(value: unknown): Id {
      return parseOrReject(this.idTypes.forCollection(collection), value);
    }
  }
  return mixin(IdPipe);
}

interface DocumentIdParams {
  documentId: unknown;
  bucketId: string;
}

@Injectable()
export class BucketDocumentIdPipe implements PipeTransform<DocumentIdParams, Promise<Id>> {
  constructor(@Inject(ID_TYPES) private readonly idTypes: IdTypes) {}

  async transform({documentId, bucketId}: DocumentIdParams): Promise<Id> {
    return parseOrReject(await this.idTypes.forBucket(bucketId), documentId);
  }
}

const documentIdParams = createParamDecorator(
  (
    {documentParam, bucketParam}: {documentParam: string; bucketParam: string},
    ctx: ExecutionContext
  ) => {
    const {params} = ctx.switchToHttp().getRequest();
    return {documentId: params[documentParam], bucketId: params[bucketParam]};
  }
);

export const DocumentId = (documentParam: string, bucketParam: string): ParameterDecorator =>
  documentIdParams({documentParam, bucketParam}, BucketDocumentIdPipe);
