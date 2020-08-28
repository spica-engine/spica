import { Module, DynamicModule, Global } from "@nestjs/common";
import { ApiKeyController } from "./apikey.controller";
import { ApiKeyService } from "./apikey.service";
import { ApiKeyStrategy } from "./apikey.strategy";

@Global()
@Module({})
export class ApiKeyModule {
    static forRoot(): DynamicModule {
        return {
            module: ApiKeyModule,
            controllers: [
                ApiKeyController
            ],
            providers: [
                ApiKeyService,
                ApiKeyStrategy
            ]
        }
    }
}