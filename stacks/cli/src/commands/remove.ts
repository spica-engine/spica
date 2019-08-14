import {
  CommandLineOptions,
  CommandMetadata,
  CommandMetadataInput,
  CommandMetadataOption,
  validators
} from "@ionic/cli-framework";
import * as docker from "dockerode";
import {Command} from "../interface";
import {namespace} from "../validators";

export class RemoveCommand extends Command {
  async getMetadata(): Promise<CommandMetadata<CommandMetadataInput, CommandMetadataOption>> {
    return {
      name: "rm",
      summary: "Stop and remove a spica instance.",
      inputs: [
        {
          name: "namespace",
          summary: "Namespace of the spica that will be created.",
          validators: [validators.required, namespace]
        }
      ]
    };
  }

  async run([namespace]: string[], options: CommandLineOptions): Promise<void> {
    const machine = new docker();

    const foundNetworks = await machine.listNetworks({
      filters: JSON.stringify({label: [`namespace=${namespace}`]})
    });

    const foundContainers = await machine.listContainers({
      all: true,
      filters: JSON.stringify({label: [`namespace=${namespace}`]})
    });

    if (!foundNetworks.length && !foundContainers.length) {
      this.namespace.logger.warn(`There is no instance with name ${namespace} exists.`);
      return;
    }

    if (foundContainers.length) {
      await this.namespace.logger.spin({
        text: `Removing containers (0/${foundContainers.length}).`,
        op: spinner => {
          let deleted = 0;
          function increaseDeletedCount() {
            deleted++;
            spinner.text = `Removing containers (${deleted}/${foundContainers.length}).`;
          }
          return Promise.all(
            foundContainers.map(async containerInfo =>
              machine
                .getContainer(containerInfo.Id)
                .remove({
                  v: true, // Remove volumes attached to the container
                  force: true // Stop if the container running
                })
                .then(() => increaseDeletedCount())
            )
          );
        }
      });
    }

    if (foundNetworks.length) {
      await this.namespace.logger.spin({
        text: `Removing networks (0/${foundNetworks.length}).`,
        op: spinner => {
          let deleted = 0;
          function increaseDeletedCount() {
            deleted++;
            spinner.text = `Removing networks (${deleted}/${foundNetworks.length}).`;
          }
          return Promise.all(
            foundNetworks.map(network =>
              machine
                .getNetwork(network.Id)
                .remove()
                .then(() => increaseDeletedCount())
            )
          );
        }
      });
    }

    this.namespace.logger.success(`Spica ${namespace} was successfully deleted.`);
  }
}
