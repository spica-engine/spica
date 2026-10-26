import {Injectable} from "@nestjs/common";
import {ResourceRef, ResultShaper} from "@spica-server/interface-data";

@Injectable()
export class PassthroughResultShaper implements ResultShaper {
  shape<T>(_resource: ResourceRef, result: T): T {
    return result;
  }
}
