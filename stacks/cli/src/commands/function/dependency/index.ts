import {Namespace, NamespaceMetadata, CommandMap} from "@ionic/cli-framework";
import {InstallCommand} from "./install";
export * from "./install";

export class DependencyNamespace extends Namespace {
  async getMetadata(): Promise<NamespaceMetadata> {
    return {
      name: "dependency",
      summary: "Dependency commands that will allow to install or remove npm-packages"
    };
  }
  async getCommands(): Promise<CommandMap> {
    return new CommandMap([["install", async () => new InstallCommand(this)]]);
  }
}
