import {
  Action,
  ActionParameters,
  CaporalValidator,
  Command,
  CreateCommandParameters
} from "@caporal/core";
import * as getport from "get-port";
import * as open from "open";
import {Stream} from "stream";
import {spin} from "../../console";
import {projectName} from "../../validator";
import * as path from "path";
import * as fs from "fs";
import {DockerMachine} from "../../project";

function streamToBuffer(stream: Stream): Promise<Buffer> {
  return new Promise(resolve => {
    const response = [];
    if (process.platform.includes("win")) {
      stream.once("resume", () => {
        setTimeout(() => {
          resolve(Buffer.concat(response));
        }, 2000);
      });
    }
    stream.on("data", chunk => response.push(chunk));
    stream.on("end", () => resolve(Buffer.concat(response)));
  });
}

async function create({args: cmdArgs, options}: ActionParameters) {
  const {name}: {name?: string} = cmdArgs;

  const machine = new DockerMachine();

  const networkName = `${name}-network`,
    databaseName = `${name}-db`,
    port = await getport({port: options.port as number}),
    publicHost = `http://localhost:${port}`,
    apiUrl = `${publicHost}/api`,
    functionApiUrl = apiUrl.replace("localhost", "host.docker.internal");

  if (options.port.toString() != port.toString() && options.port != 4500) {
    console.info(`Port ${options.port} already in use, the port ${port} will be used instead.`);
  }

  let identifier = "spica";
  let password = "spica";
  let args = [];
  if (options.apiOptions) {
    const filename = path.resolve(options.apiOptions as string);
    const rawFile = fs.readFileSync(filename, {encoding: "utf8"});

    let apiOptions = {};
    try {
      apiOptions = JSON.parse(rawFile);
      identifier = apiOptions["passport-default-identity-identifier"] || identifier;
      password = apiOptions["passport-default-identity-password"] || password;
    } catch (error) {
      throw Error(`Error while parsing api-options file. ${error}`);
    }

    for (const [key, value] of Object.entries(apiOptions)) {
      args.push(`--${key}=${value}`);
    }
  }

  args = [
    ...args,
    // If user defines some of these values in the apiOptions file, they will be overwriten.
    // We should explain this behavior to users on the documentation or somewhere else.
    `--database-name=${name}`,
    `--database-replica-set=${name}`,
    `--database-uri="mongodb://${databaseName}-0,${databaseName}-1,${databaseName}-2"`,
    `--public-url=${apiUrl}`,
    `--function-api-url=${functionApiUrl}`,
    `--passport-secret=${name}`,
    `--persistent-path=/var/data`
  ];

  const foundNetworks = await machine.listNetworks({
    filters: JSON.stringify({label: [`namespace=${name}`]})
  });

  const foundContainers = await machine.listContainers({
    all: true,
    filters: JSON.stringify({label: [`namespace=${name}`]})
  });

  if ((foundNetworks.length || foundContainers.length) && !options.force) {
    console.warn(
      `There is a instance with name ${name} already exists.\nUse --force to delete existing one.`
    );
    return;
  }

  if (options.force && (foundNetworks.length || foundContainers.length)) {
    await spin({
      text: `Shutting down and removing the previous containers, networks${
        !options.retainVolumes ? ", and volumes" : ""
      }.`,
      op: async () => {
        await Promise.all(
          foundContainers.map(async containerInfo => {
            const container = await machine.getContainer(containerInfo.Id);
            await container.remove({
              v: true, // Remove volumes attached to the container
              force: true // Stop if the container running
            });
            return new Promise(resolve => setTimeout(resolve, 1000));
          })
        );
        await Promise.all(foundNetworks.map(network => machine.getNetwork(network.Id).remove()));
        if (!options.retainVolumes) {
          const foundVolumes = (await machine.listVolumes({
            filters: JSON.stringify({label: [`namespace=${name}`]})
          })).Volumes;
          await Promise.all(foundVolumes.map(volume => machine.getVolume(volume.Name).remove()));
        }
      }
    });
  }

  await spin({
    text: `Pulling images.`,
    op: async spinner => {
      const images = [
        {
          image: "spicaengine/api",
          tag: options.imageVersion.toString()
        },
        {
          image: "spicaengine/spica",
          tag: options.imageVersion.toString()
        },
        {
          image: "mongo",
          tag: "4.2"
        },
        {
          image: "nginx",
          tag: "latest"
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

  const network = await spin({
    text: `Creating a network named ${networkName}.`,
    op: machine.createNetwork({
      Name: networkName,
      Labels: {namespace: name}
    })
  });

  async function createMongoDB(instanceIndex: number) {
    const container = await machine.createContainer({
      Image: "mongo:4.2",
      name: `${databaseName}-${instanceIndex}`,
      Cmd: ["--replSet", name, "--bind_ip_all"],
      Labels: {namespace: name},
      HostConfig: {
        RestartPolicy: {
          Name: options.restart ? "unless-stopped" : "no"
        },
        Mounts: [
          {
            Source: `${name}-db-${instanceIndex}`,
            Type: "volume",
            Target: "/data/db",
            VolumeOptions: {
              DriverConfig: {
                Name: "local",
                Options: {}
              },
              NoCopy: false,
              Labels: {namespace: name}
            }
          }
        ]
      }
    });
    await network.connect({Container: container.id});
    return container.start();
  }

  const databaseReplicas = options.databaseReplicas;

  await spin({
    text: `Creating database containers (1/${databaseReplicas})`,
    op: async spinner => {
      for (let index = 0; index < Number(databaseReplicas); index++) {
        await createMongoDB(index);
        spinner.text = `Creating database containers (${index + 1}/${databaseReplicas})`;
      }
    }
  });

  await spin({
    text: "Waiting the database containers to become ready.",
    op: async spinner => {
      const replSetConfig = JSON.stringify({
        _id: name,
        members: new Array(databaseReplicas).fill(0).map((_, index) => {
          return {_id: index, host: `${databaseName}-${index}`};
        })
      });

      const firstContainer = machine.getContainer(`${databaseName}-0`);

      const initiateReplication = async (reconfig = false) => {
        spinner.text = "Initiating replication between database containers.";
        const exec = await firstContainer.exec({
          Cmd: [
            "mongo",
            "admin",
            "--eval",
            reconfig
              ? `rs.reconfig(${replSetConfig}, { force: true })`
              : `rs.initiate(${replSetConfig})`
          ],
          AttachStderr: true,
          AttachStdout: true
        });
        const result = await exec.start({});
        const buffer = await streamToBuffer(result);
        return buffer.toString();
      };

      let output = await initiateReplication();
      let retry = 0,
        maxRetries = 5,
        wait = 1000;

      while (retry < maxRetries) {
        retry++;
        if (output.indexOf("Connection refused")) {
          output = await initiateReplication();
        } else {
          break;
        }
        await new Promise(resolve => setTimeout(resolve, wait));
        spinner.text = `Initiating replication between database containers. Retrying ${retry}`;
      }

      if (output.indexOf('"already initialized"') != -1) {
        output = await initiateReplication(true);
      }

      if (output.indexOf('"ok" : 1') == -1) {
        return Promise.reject(output);
      }
    }
  });

  await spin({
    text: "Waiting for the replica set to become ready.",
    op: async () => {
      const firstContainer = machine.getContainer(`${databaseName}-0`);

      for (let i = 0; i < 15; i++) {
        const exec = await firstContainer.exec({
          Cmd: ["mongo", "admin", "--eval", "rs.status()"],
          AttachStderr: true,
          AttachStdout: true
        });
        const output = await exec.start({});
        const response = await streamToBuffer(output);
        const responseText = response.toString("utf-8");
        if (
          responseText.indexOf('"ok" : 1') > -1 &&
          responseText.indexOf('"stateStr" : "PRIMARY"') > -1
        ) {
          return Promise.resolve();
        }
        // Wait some to try again
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      return Promise.reject("Replica Set did not become ready in 30 seconds.");
    }
  });

  await spin({
    text: `Creating spica containers (0/2)`,
    op: async spinner => {
      const client = await machine.createContainer({
        Image: `spicaengine/spica:${options.imageVersion}`,
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
        Cmd: args,
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
    text: `Creating an ingress to route traffic.`,
    op: async () => {
      const proxy = await machine.createContainer({
        Image: `nginx:latest`,
        name: `${name}-ingress`,
        HostConfig: {
          PortBindings: {"80/tcp": [{HostPort: port.toString()}]},
          RestartPolicy: {
            Name: options.restart ? "unless-stopped" : "no"
          }
        },
        Labels: {namespace: name}
      });
      await network.connect({Container: proxy.id});
      await proxy.start();
      const nginxConfig = `
      upstream ${name}-api {
        server ${name}-api;
      }
      upstream ${name}-spica {
        server ${name}-spica;
      }
      server {
        listen       80;
        server_name  localhost;

        location ~ ^/api/?(.*) {
          proxy_pass http://${name}-api/$1$is_args$args;
          proxy_set_header Host $host;
          proxy_set_header X-Forwarded-Proto $scheme;
          proxy_set_header X-Forwarded-Port $server_port;
          proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
          proxy_http_version 1.1;
          proxy_set_header Upgrade $http_upgrade;
          proxy_set_header Connection "Upgrade";
        }

        location ~ ^/?(.*) {
          proxy_pass http://${name}-spica/$1$is_args$args;
          proxy_set_header Host $host;
          proxy_set_header X-Forwarded-Proto $scheme;
          proxy_set_header X-Forwarded-Port $server_port;
          proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
          proxy_http_version 1.1;
          proxy_set_header Upgrade $http_upgrade;
          proxy_set_header Connection "Upgrade";
        }
      }
      `;
      const exec = await proxy.exec({
        Cmd: ["bash", "-c", `echo '${nginxConfig}' > /etc/nginx/conf.d/default.conf`],
        AttachStderr: true,
        AttachStdout: true
      });
      const output = await exec.start({});
      await streamToBuffer(output);
      await proxy.restart();
    }
  });
  console.info(`
Spica ${name} is serving on ${publicHost}.
Open your browser on ${publicHost} to login.

Identitifer: ${identifier}
Password: ${password}
  `);

  if (options.open) {
    await open(`${publicHost}/spica`);
  }
}

export default function({createCommand}: CreateCommandParameters): Command {
  return createCommand("Start a project on your local machine.")
    .argument("<name>", "Name of the project.", {validator: projectName})
    .option(
      "-p, --port",
      "Port that ingress will serve on. If not specified an open port will be used.",
      {
        default: "4500",
        required: true,
        validator: CaporalValidator.NUMBER
      }
    )
    .option("--image-version", "Version of the spica to run.", {
      default: "latest",
      validator: CaporalValidator.STRING
    })
    .option("-o, --open", "Open project authorization page after creation.", {
      validator: CaporalValidator.BOOLEAN
    })
    .option("-f, --force", "Remove the existing project if exists with same name.", {
      validator: CaporalValidator.BOOLEAN
    })
    .option("--retain-volumes", "When false, the existing data will be removed.", {
      default: true,
      validator: CaporalValidator.BOOLEAN
    })
    .option("--restart", "Restart failed containers if exits unexpectedly.", {
      default: true,
      validator: CaporalValidator.BOOLEAN
    })
    .option(
      "--image-pull-policy",
      "Image pull policy. when 'if-not-present' images won't be pulled in if already present on the docker.",
      {
        default: "if-not-present",
        validator: ["if-not-present", "default"]
      }
    )
    .option("--database-replicas", "Number of database nodes.", {
      default: "1",
      validator: CaporalValidator.NUMBER
    })
    .option(
      "--api-options",
      "Absolute file path that contains api key options as key value in JSON format.",
      {
        validator: CaporalValidator.STRING
      }
    )
    .action((create as unknown) as Action);
}
