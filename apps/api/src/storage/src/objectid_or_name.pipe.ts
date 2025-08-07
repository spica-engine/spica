import {PipeTransform, Injectable, BadRequestException} from "@nestjs/common";
import {ObjectId} from "@spica-server/database";

@Injectable()
export class ObjectIdOrNamePipe implements PipeTransform {
  transform(value: string): ObjectId | string {
    if (/^[a-f\d]{24}$/i.test(value)) {
      return new ObjectId(value);
    }
    return value;
  }
}
