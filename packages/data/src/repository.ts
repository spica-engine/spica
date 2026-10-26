import {FactoryProvider} from "@nestjs/common";
import {ModuleRef} from "@nestjs/core";
import {REPOSITORY_CLASSES, RepositoryClasses} from "@spica-server/interface-data";

/**
 * Creates the bound engine's repository within the calling module, so it receives that module's
 * options and is only created when the module is loaded.
 */
export function provideRepository(token: symbol): FactoryProvider {
  return {
    provide: token,
    useFactory: (classes: RepositoryClasses, moduleRef: ModuleRef) => {
      const repository = classes.get(token);
      if (!repository) {
        throw new Error(`The data adapter does not provide ${token.description}.`);
      }
      return moduleRef.create(repository);
    },
    inject: [REPOSITORY_CLASSES, ModuleRef]
  };
}
