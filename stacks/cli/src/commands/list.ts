import {
  CommandLineOptions,
  CommandMetadata,
  CommandMetadataInput,
  CommandMetadataOption
} from "@ionic/cli-framework";
import * as docker from "dockerode";
import {Command} from "../interface";

export class ListCommand extends Command {
  async getMetadata(): Promise<CommandMetadata<CommandMetadataInput, CommandMetadataOption>> {
    return {
      name: "list",
      summary: "Shows a list of spica instances running on this machine."
    };
  }

  async run(input: string[], options: CommandLineOptions): Promise<void> {
    const machine = new docker();

    const foundNetworks: docker.NetworkInfo[] = await machine.listNetworks({
      filters: JSON.stringify({label: {namespace: true}})
    });

    const instances = [];

    for (const network of foundNetworks) {
      const containers = await machine.listContainers({
        all: true,
        filters: JSON.stringify({label: [`namespace=${network["Labels"].namespace}`]})
      });

      const instance: any = {NAMESPACE: network["Labels"].namespace, DESCRIPTION: [], PORT: "-"};

      instances.push(instance);

      const api = containers.find(container => container.Image.startsWith("spicaengine/api"));
      const spica = containers.find(container => container.Image.startsWith("spicaengine/spica"));
      const ingress = containers.find(container => container.Image.startsWith("nginx"));

      instance.VERSION = api.Image.split(":")[1];
      instance.CREATED = api.Created;

      if (ingress.State == "running" && ingress.Ports.length) {
        const [port] = ingress.Ports;
        instance.PORT = `${port.IP}:${port.PublicPort}->${port.PrivatePort}/${port.Type}`;
      }

      if (api.State == "running" && spica.State == "running" && ingress.State == "running") {
        instance.STATE = ingress.State;
        instance.STATUS = ingress.Status;
      } else {
        const downContainer =
          ingress.State != "running" ? ingress : api.State != "running" ? api : spica;
        instance.STATUS = downContainer.Status;
        instance.DESCRIPTION.push(
          `The container ${
            downContainer.Image.startsWith("nginx") ? "Ingress" : downContainer.Names[0].slice(1)
          } is down.`
        );
      }

      const databaseContainers = containers.filter(container =>
        container.Image.startsWith("mongo")
      );

      const runningDatabaseContainers = containers.filter(
        container => container.Image.startsWith("mongo") && container.State == "running"
      );

      if (runningDatabaseContainers.length != databaseContainers.length) {
        instance.DESCRIPTION.push(`Some database containers are down.`);
      }
    }

    this.namespace.logger.table(instances, [
      "NAMESPACE",
      "CREATED",
      "STATUS",
      "VERSION",
      "PORT",
      "DESCRIPTION"
    ]);
  }
}
