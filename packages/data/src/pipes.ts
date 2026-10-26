import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  mixin,
  PipeTransform,
  Type
} from "@nestjs/common";
import {Id, ID_TYPES, IdTypes} from "@spica-server/interface-data";

export function ID(collection: string): Type<PipeTransform<unknown, Id>> {
  @Injectable()
  class IdPipe implements PipeTransform<unknown, Id> {
    constructor(@Inject(ID_TYPES) private readonly idTypes: IdTypes) {}

    transform(value: unknown): Id {
      if (!value) {
        throw new HttpException("Invalid id.", HttpStatus.BAD_REQUEST);
      }
      try {
        return this.idTypes.forCollection(collection).parse(value);
      } catch {
        throw new HttpException("Invalid id.", HttpStatus.BAD_REQUEST);
      }
    }
  }
  return mixin(IdPipe);
}
