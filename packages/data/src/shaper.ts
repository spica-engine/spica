import {Injectable} from "@nestjs/common";
import {ResourceRef, ResultShaper} from "@spica-server/interface-data";

@Injectable()
export class PassthroughResultShaper implements ResultShaper {
  shape<I, O = I>(_resource: ResourceRef, input: I): Promise<O> {
    return Promise.resolve(input as unknown as O);
  }
}
