import {FactoryProvider} from "@nestjs/common";
import {ModuleRef} from "@nestjs/core";
import {isExpiring, REPOSITORY_CLASSES, RepositoryClasses} from "@spica-server/interface-data";

/**
 * Creates the bound engine's repository within the calling module, so it receives that module's
 * options and is only created when the module is loaded.
 */
export function provideRepository(token: symbol): FactoryProvider {
  return {
    provide: token,
    useFactory: async (classes: RepositoryClasses, moduleRef: ModuleRef) => {
      const repository = classes.get(token);
      if (!repository) {
        throw new Error(`The data adapter does not provide ${token.description}.`);
      }
      const instance = await moduleRef.create(repository);
      if (isExpiring(instance)) {
        await instance.applyExpiry();
      }
      return instance;
    },
    inject: [REPOSITORY_CLASSES, ModuleRef]
  };
}
