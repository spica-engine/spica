import {DynamicModule, Module, HttpModule} from "@nestjs/common";
import {Project} from "./project";
import {ComposerGateway} from "./composer.gateway";
import {ComposerOptions, COMPOSER_OPTIONS} from "./interface";
import {Viewport} from "./viewport";

@Module({})
export class ComposerModule {
  static forRoot(options: Partial<ComposerOptions>): DynamicModule {
    return {
      module: ComposerModule,
      imports: [HttpModule],
      providers: [
        Viewport,
        {
          provide: COMPOSER_OPTIONS,
          useValue: {version: "8.1.1", ...options}
        },
        {
          provide: Project,
          useFactory: options => new Project(options),
          inject: [COMPOSER_OPTIONS]
        },
        ComposerGateway
      ]
    };
  }
}
