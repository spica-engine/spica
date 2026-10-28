import {Injectable} from "@nestjs/common";
import {CollectionQueryFacade} from "@spica-server/interface-data";

const UNSUPPORTED =
  "Reading system records through the query facade is not supported on PostgreSQL yet.";

@Injectable()
export class UnsupportedCollectionQueryFacade implements CollectionQueryFacade {
  async find(): Promise<never> {
    throw new Error(UNSUPPORTED);
  }

  async findOne(): Promise<never> {
    throw new Error(UNSUPPORTED);
  }

  async paginate(): Promise<never> {
    throw new Error(UNSUPPORTED);
  }
}
