import {DynamicModule, Global, Inject, Module, Optional} from "@nestjs/common";
import {SchemaModule, Validator} from "@spica-server/core/schema";
import {BlacklistedTokenController} from "./blacklistedtoken.controller";
import {BlacklistedTokenService} from "./blacklistedtoken.service";
import BlacklistedTokenSchema = require("./schemas/blacklistedtoken.json");
import {BLACKLISTEDTOKEN_OPTIONS, BlacklistedTokenOptions} from "./options";
@Module({})
export class BlacklistedTokenModule {
  static forRoot(options: BlacklistedTokenOptions): DynamicModule {
    return {
      module: BlacklistedTokenModule,
      imports: [
        SchemaModule.forChild({
          schemas: [BlacklistedTokenSchema]
        })
      ],
      exports: [BlacklistedTokenService],
      controllers: [BlacklistedTokenController],
      providers: [
        BlacklistedTokenService,
        {
          provide: BLACKLISTEDTOKEN_OPTIONS,
          useValue: options
        },
      ]
    };
  }
}
