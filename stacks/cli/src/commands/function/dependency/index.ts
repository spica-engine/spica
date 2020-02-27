import {Namespace, NamespaceMetadata, CommandMap} from "@ionic/cli-framework";
import {InstallCommand} from "./install";

export class DependencyNamespace extends Namespace {
  async getMetadata(): Promise<NamespaceMetadata> {
    return {
      name: "dependency",
      summary: "Dependency summary",
      description: "Dependency description"
    };
  }
  async getCommands(): Promise<CommandMap> {
    return new CommandMap([["install", async () => new InstallCommand(this)]]);
  }
}
