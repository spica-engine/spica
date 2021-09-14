import {Module} from "@nestjs/common";
import {GraphqlController} from "./graphql";

@Module({})
export class GraphQLModule {
  static forRoot() {
    return {
      module: GraphQLModule,
      providers: [GraphqlController],
      imports: []
    };
  }
}
