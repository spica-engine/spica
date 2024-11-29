import {Action, ActionParameters, Command, CreateCommandParameters, Program} from "@caporal/core";
import * as docker from "dockerode";
import {spin} from "../../console";
import {projectName} from "../../validator";

async function remove({args, options}: ActionParameters) {
  const {name} = args;

  const machine = new docker();

  const foundNetworks = await machine.listNetworks({
    filters: JSON.stringify({label: [`namespace=${name}`]})
  });

  const foundContainers = await machine.listContainers({
    all: true,
    filters: JSON.stringify({label: [`namespace=${name}`]})
  });

  if (!foundNetworks.length && !foundContainers.length) {
    return console.warn(`There is no instance with name ${name}.`);
  }

  if (foundContainers.length) {
    await spin({
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
    await spin({
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

  if (!options.retainVolumes) {
    const foundVolumes = (await machine.listVolumes({
      filters: JSON.stringify({label: [`namespace=${name}`]})
    })).Volumes;
    await spin({
      text: `Removing volumes (0/${foundVolumes.length}).`,
      op: spinner => {
        let deleted = 0;
        function increaseDeletedCount() {
          deleted++;
          spinner.text = `Removing volumes (${deleted}/${foundVolumes.length}).`;
        }
        return Promise.all(
          foundVolumes.map(volume =>
            machine
              .getVolume(volume.Name)
              .remove()
              .then(() => increaseDeletedCount())
          )
        );
      }
    });
  }

  console.info(`Spica ${name} was successfully deleted.`);
}

export default function(program: Program): Command {
  return program
    .command("project remove", "Stop and remove a local project.")
    .argument("<name>", "Name of the project to remove.", {validator: projectName})
    .option("--retain-volumes", "When false, the data will be removed along with the containers.", {
      default: true
    })
    .action((remove as unknown) as Action);
}
