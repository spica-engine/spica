import {Namespace, NamespaceMetadata, NamespaceMap} from "@ionic/cli-framework";
import {DependencyNamespace} from "./dependency";

export class FunctionNamespace extends Namespace {
  async getMetadata(): Promise<NamespaceMetadata> {
    return {
      name: "function",
      summary: "function summary",
      description: "function description"
    };
  }

  async getNamespaces(): Promise<NamespaceMap> {
    return new NamespaceMap([["dependency", async () => new DependencyNamespace(this)]]);
  }
}
