import { Global, Module, DynamicModule } from "@nestjs/common";
import { StackController } from "./stack.controller";

@Global()
@Module({})
export class StackModule {
    static forRoot(): DynamicModule {
        return {
            module: StackModule,
            controllers: [
                StackController
            ]
        }
    }
}