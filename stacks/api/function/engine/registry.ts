import {Injectable, OnModuleInit} from "@nestjs/common";
import {ModulesContainer} from "@nestjs/core";
import {Module, ModuleMetadata, MODULE_METADATA} from "./module/base";
import {Trigger, TriggerMetadata, TRIGGER_METADATA} from "./trigger/base";

@Injectable()
export class EngineRegistry implements OnModuleInit {
  private triggers = new Map<string, TriggerMetadata & Trigger>();
  private modules = new Array<ModuleMetadata & Module>();

  constructor(private readonly container: ModulesContainer) {}

  onModuleInit() {
    this.container.forEach(module =>
      module.providers.forEach((provider, key) => {
        if (provider.isNotMetatype) {
          return;
        }

        const triggerMetadata = Reflect.getMetadata(
          TRIGGER_METADATA,
          provider.metatype
        ) as TriggerMetadata;
        if (triggerMetadata) {
          const instance = module.getProviderByKey<Trigger>(key).instance;
          this.triggers.set(triggerMetadata.name, {
            ...triggerMetadata,
            register: instance.register.bind(instance),
            schema: instance.schema.bind(instance),
            stub: instance.stub && instance.stub.bind(instance),
            info: instance.info.bind(instance)
          });
        }

        const moduleMetadata = Reflect.getMetadata(
          MODULE_METADATA,
          provider.metatype
        ) as ModuleMetadata;

        if (moduleMetadata) {
          const instance = module.getProviderByKey<Module>(key).instance;
          this.modules.push({
            ...moduleMetadata,
            create: instance.create.bind(instance)
          });
        }
      })
    );
  }

  getTrigger(name: string) {
    return this.triggers.get(name);
  }

  getTriggers() {
    return new Array(...this.triggers.values());
  }

  getModules(): {
    [key: string]: object;
  } {
    return this.modules.reduce((accumulator, module) => {
      accumulator[module.moduleSpecifier] = module.create();
      return accumulator;
    }, {});
  }
}
