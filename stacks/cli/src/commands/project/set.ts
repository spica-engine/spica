import {ActionParameters, CaporalValidator, Command, CreateCommandParameters} from "@caporal/core";
import {projectName} from "../../validator";
import {spin} from "../../console";
import {DockerMachine} from "../project";

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

  let oldClient = projectContainers.find(c => c.Image.startsWith("spicaengine/spica"));
  if(!oldClient){
    console.info("Client container is missing, it will be recreated.")
  }

  const oldApi = projectContainers.find(c => c.Image.startsWith("spicaengine/api"));

  const clientVersion = oldClient.Image.substring(oldClient.Image.indexOf(":") + 1);
  const apiVersion = oldApi.Image.substring(oldApi.Image.indexOf(":") + 1);

  if (clientVersion == desiredVersion && apiVersion == desiredVersion) {
    return console.log(`Project '${name}' has been using '${desiredVersion}' image already.`);
  }

  const commands = oldApi.Command.split(" ");

  await spin({
    text: "Shutting down and removing the previous containers..",
    op: async () => {
      await Promise.all(
        [oldClient, oldApi].map(async containerInfo => {
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
        Image: `spicaengine/api:${options.imageVersion}`,
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

  console.dir(oldClient, {depth: Infinity});

  //   console.info(`
  // Spica ${name} is serving on ${oldClient}.
  // Open your browser on ${publicHost} to login.

  // Identitifer: ${identifier}
  // Password: ${password}
  //   `);

  //   if (options.open) {
  //     await open(`${publicHost}/spica`);
  //   }

  // await startSpicaContainers(name, {imageVersion: desiredVersion}, network, commands);
}

export default function({createCommand}: CreateCommandParameters): Command {
  return createCommand("Upgrade or downgrade your existing project version.")
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
