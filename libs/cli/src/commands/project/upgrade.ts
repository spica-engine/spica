import {ActionParameters, CaporalValidator, Command, CreateCommandParameters} from "@caporal/core";
import {projectName} from "../../validator";
import {spin} from "../../console";
import {DockerMachine, isVersionUpgrade, version} from "../../project";

async function upgrade({args, options}: ActionParameters) {
  const name = args.name as string;
  const desiredVersion = args.to as string;

  const machine = new DockerMachine();

  const projectContainers = await machine.listContainers({
    all: true,
    filters: JSON.stringify({label: [`namespace=${name}`]})
  });

  if (!projectContainers.length) {
    return console.error(`Project '${name}' does not exist.`);
  }

  const oldClient = projectContainers.find(c => c.Image.startsWith("spicaengine/spica"));
  if (!oldClient) {
    return console.error(
      "Unable to upgrade the version of the project. Make sure that it's running with no issue."
    );
  }

  const oldApi = projectContainers.find(c => c.Image.startsWith("spicaengine/api"));
  if (!oldApi) {
    return console.error(
      "Unable to upgrade the version of the project. Make sure that it's running with no issue"
    );
  }

  const oldClientVersion = await version(oldClient.Image);
  if (!isVersionUpgrade(desiredVersion, oldClientVersion)) {
    return console.error(
      `Requested version(${desiredVersion}) is not greater than current version(${oldClientVersion}).`
    );
  }

  const oldApiVersion = await version(oldApi.Image);
  if (!isVersionUpgrade(desiredVersion, oldApiVersion)) {
    return console.error(
      `Requested version(${desiredVersion}) is greater than current version(${oldApiVersion}).`
    );
  }

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

      images.push({
        image: "spicaengine/migrate",
        tag: desiredVersion
      });

      let pulled = 0;

      function increasePulledCount() {
        pulled++;
        spinner.text = `Pulling images (${pulled}/${images.length})`;
      }
      return Promise.all(
        images.map(image =>
          machine.pullImage(image.image, image.tag).then(() => increasePulledCount())
        )
      );
    }
  });

  const commands = oldApi ? oldApi.Command.split(" ") : [];

  await spin({
    text: "Shutting down and removing the old containers..",
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

  console.info(`Project '${name}' version has been set to the version ${desiredVersion}.`);
}

export default function({createCommand}: CreateCommandParameters): Command {
  return createCommand("Upgrade the version of existing local project.")
    .argument("<name>", "Name of the project.", {validator: projectName})
    .argument("<to>", "Version of the spica.")
    .option("--restart", "Restart failed containers if exits unexpectedly.", {
      default: true,
      validator: CaporalValidator.BOOLEAN
    })
    .action(upgrade);
}
