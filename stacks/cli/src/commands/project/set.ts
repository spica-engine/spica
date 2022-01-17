import {ActionParameters, CaporalValidator, Command, CreateCommandParameters} from "@caporal/core";
import {projectName} from "../../validator";
import {spin} from "../../console";
import {DockerMachine} from "../../project";
import * as semver from "semver";

async function set({args, options}: ActionParameters) {
  const name = args.name as string;
  const desiredVersion = args.version as string;

  const machine = new DockerMachine();

  const projectContainers = await machine.listContainers({
    all: true,
    filters: JSON.stringify({label: [`namespace=${name}`]})
  });

  if (!projectContainers.length) {
    return console.error(`Project '${name}' does not exist.`);
  }

  let oldClientVersion;
  const oldClient = projectContainers.find(c => c.Image.startsWith("spicaengine/spica"));
  if (!oldClient) {
    return console.error(
      "Unable to set the version of the project. Make sure that it's running with no issue."
    );
  }
  oldClientVersion = oldClient.Image.substring(oldClient.Image.indexOf(":") + 1);

  let oldApiVersion;
  const oldApi = projectContainers.find(c => c.Image.startsWith("spicaengine/api"));
  if (!oldApi) {
    return console.error(
      "Unable to set the version of the project. Make sure that it's running with no issue"
    );
  }
  oldApiVersion = oldApi.Image.substring(oldApi.Image.indexOf(":") + 1);

  if (oldClientVersion == desiredVersion && oldApiVersion == desiredVersion) {
    return console.warn(`Version of the project '${name}' is already '${desiredVersion}'.`);
  }

  const isVersionUpgrade = semver.gt(desiredVersion, oldApiVersion);

  const commands = oldApi ? oldApi.Command.split(" ") : [];

  await spin({
    text: "Shutting down and removing the previous containers..",
    op: async () => {
      await Promise.all(
        [oldClient, oldApi].map(async containerInfo => {
          if (!containerInfo) {
            return;
          }
          const container = await machine.getContainer(containerInfo.Id);
          await container.remove({
            v: true, // Remove volumes attached to the container
            force: true // Stop if the container running
          });
          return new Promise(resolve => setTimeout(resolve, 1000));
        })
      );
    }
  });

  const network = await machine
    .listNetworks({
      filters: JSON.stringify({label: [`namespace=${name}`]})
    })
    .then(([networkInfo]) => machine.getNetwork(networkInfo.Id));

  await spin({
    text: "Pulling images..",
    op: async spinner => {
      const images = [
        {
          image: "spicaengine/api",
          tag: desiredVersion
        },
        {
          image: "spicaengine/spica",
          tag: desiredVersion
        }
      ];

      if (isVersionUpgrade) {
        images.push({
          image: "spicaengine/migrate",
          tag: desiredVersion
        });
      }

      const imagesToPull: typeof images = [];

      for (const image of images) {
        const exists = await machine.doesImageExist(image.image, image.tag);
        if (exists && options.imagePullPolicy == "if-not-present") {
          continue;
        }
        imagesToPull.push(image);
      }

      let pulled = 0;

      function increasePulledCount() {
        pulled++;
        spinner.text = `Pulling images (${pulled}/${imagesToPull.length})`;
      }
      return Promise.all(
        imagesToPull.map(image =>
          machine.pullImage(image.image, image.tag).then(() => increasePulledCount())
        )
      );
    }
  });

  await spin({
    text: `Creating spica containers (0/2)`,
    op: async spinner => {
      const client = await machine.createContainer({
        Image: `spicaengine/spica:${desiredVersion}`,
        name: `${name}-spica`,
        Env: ["BASE_URL=/"],
        Labels: {namespace: name},
        HostConfig: {
          RestartPolicy: {
            Name: options.restart ? "unless-stopped" : "no"
          }
        }
      });
      await network.connect({Container: client.id});
      await client.start();

      spinner.text = `Creating spica containers (1/2)`;

      const api = await machine.createContainer({
        Image: `spicaengine/api:${desiredVersion}`,
        name: `${name}-api`,
        Cmd: commands,
        Labels: {namespace: name},
        ExposedPorts: {"80/tcp": {}},
        HostConfig: {
          RestartPolicy: {
            Name: options.restart ? "unless-stopped" : "no"
          },
          Mounts: [
            {
              Target: "/var/data",
              Source: `${name}-api`,
              Type: "volume",
              VolumeOptions: {
                NoCopy: false,
                Labels: {namespace: name},
                DriverConfig: {
                  Name: "local",
                  Options: {}
                }
              }
            }
          ]
        }
      });
      await network.connect({Container: api.id});
      await api.start();
      //wait for the api initialization
      await new Promise(resolve => setTimeout(resolve, 2000));

      spinner.text = `Creating spica containers (2/2)`;
    }
  });

  if (isVersionUpgrade) {
    await spin({
      text: "Migrating existing data to the new version.",
      op: async _ => {
        const existingMigrate = projectContainers.find(p =>
          p.Image.startsWith("spicaengine/migrate")
        );

        if (existingMigrate) {
          await machine.getContainer(existingMigrate.Id).remove();
        }

        const databaseUriCommand = commands.find(c => c.startsWith("--database-uri="));
        const databaseNameCommand = commands.find(c => c.startsWith("--database-name="));

        const migrate = await machine.createContainer({
          Image: `spicaengine/migrate:${desiredVersion}`,
          name: `${name}-migrate`,
          Labels: {namespace: name},
          Cmd: [
            `--from=${oldApiVersion}`,
            `--to=${desiredVersion}`,
            databaseUriCommand,
            databaseNameCommand,
            "--continue-if-versions-are-equal=true"
          ],
          HostConfig: {
            RestartPolicy: {
              Name: "on-failure",
              MaximumRetryCount: 3
            }
          }
        });
        await network.connect({Container: migrate.id});
        await migrate.start();
      }
    });
  }

  console.info(`Project '${name}' version has been set to ${desiredVersion}.`);
}

export default function({createCommand}: CreateCommandParameters): Command {
  return createCommand("Upgrade or downgrade the version of your existing project.")
    .argument("<name>", "Name of the project.", {validator: projectName})
    .argument("<version>", "Version of the spica.")
    .option(
      "--image-pull-policy",
      "Image pull policy. when 'if-not-present' images won't be pulled in if already present on the docker.",
      {
        default: "if-not-present",
        validator: ["if-not-present", "default"]
      }
    )
    .option("--restart", "Restart failed containers if exits unexpectedly.", {
      default: true,
      validator: CaporalValidator.BOOLEAN
    })
    .option("-o, --open", "Open project authorization page after creation.", {
      validator: CaporalValidator.BOOLEAN
    })
    .action(set);
}
