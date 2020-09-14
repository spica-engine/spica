import {
  CommandLineOptions,
  CommandMetadata,
  CommandMetadataInput,
  CommandMetadataOption,
  validators
} from "@ionic/cli-framework";
import * as docker from "dockerode";
import * as getport from "get-port";
import * as open from "open";
import {Stream} from "stream";
import {ImageNotFoundError} from "../errors";
import {Command} from "../interface";
import {namespace} from "../validators";

export class ServeCommand extends Command {
  async getMetadata(): Promise<CommandMetadata<CommandMetadataInput, CommandMetadataOption>> {
    return {
      name: "serve",
      summary: "Run a Spica instance on your local machine.",
      inputs: [
        {
          name: "namespace",
          summary: "Namespace of the spica that will be created.",
          validators: [validators.required, namespace]
        }
      ],
      options: [
        {
          name: "port",
          type: String,
          summary: "Port that ingress will serve on. If not specified an open port will be used.",
          aliases: ["p"],
          default: "4500"
        },
        {
          name: "public-url",
          type: String,
          summary: "Publicly accessible url of the spica instance."
        },
        {
          name: "version",
          type: String,
          aliases: ["v"],
          summary: "Version of the spica that will run.",
          description: "It must be a valid semver or a version tag, eg next or latest or 1.0.0",
          default: "latest"
        },
        {
          name: "open",
          type: Boolean,
          aliases: ["o"],
          summary: "Spica page will be opened when instance setup.",
          default: true
        },
        {
          name: "force",
          type: Boolean,
          summary: "Existing instances with this name will be deleted.",
          default: false
        },
        {
          name: "retain-volumes",
          type: Boolean,
          summary: "When false, the existing data will be removed.",
          default: true
        },
        {
          name: "restart",
          type: Boolean,
          summary: "Restart failed containers if exits unexpectedly.",
          default: true
        },
        {
          name: "image-pull-policy",
          type: String,
          summary:
            "Image pull policy. when 'if-not-present' images won't be pulled in if already present on the docker.",
          default: "if-not-present"
        },
        {
          name: "database-replicas",
          type: String,
          summary: "Number of database nodes.",
          default: "1"
        }
      ]
    };
  }

  async run([namespace]: string[], options: CommandLineOptions): Promise<void> {
    const machine = new docker();

    const networkName = `${namespace}-network`,
      databaseName = `${namespace}-db`,
      port = await getport({port: parseInt(options.port.toString())}),
      publicHost = options["public-url"]
        ? options["public-url"].toString()
        : `http://localhost:${port}`;

    if (
      !options["public-url"] &&
      options.port.toString() != port.toString() &&
      options.port != "4500"
    ) {
      this.namespace.logger.info(
        `Port ${options.port} already in use, the port ${port} will be used instead.`
      );
    }

    let args = options["--"] as string[];

    args = [
      ...args,
      `--port=80`,
      `--function-api-url=http://localhost`,
      `--database-name=${namespace}`,
      `--database-replica-set=${namespace}`,
      `--database-uri="mongodb://${databaseName}-0,${databaseName}-1,${databaseName}-2"`,
      `--public-url=${publicHost}/api`,
      `--passport-password=${namespace}`,
      `--passport-secret=${namespace}`,
      `--persistent-path=/var/data`
    ];

    const foundNetworks = await machine.listNetworks({
      filters: JSON.stringify({label: [`namespace=${namespace}`]})
    });

    const foundContainers = await machine.listContainers({
      all: true,
      filters: JSON.stringify({label: [`namespace=${namespace}`]})
    });

    if ((foundNetworks.length || foundContainers.length) && !options.force) {
      this.namespace.logger.warn(
        `There is a instance with name ${namespace} already exists.\nUse --force to delete existing one.`
      );
      return;
    }

    if (options.force && (foundNetworks.length || foundContainers.length)) {
      await this.namespace.logger.spin({
        text: `Shutting down and removing the previous containers, networks${
          !options["retain-volumes"] ? ", and volumes" : ""
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
          if (!options["retain-volumes"]) {
            const foundVolumes = (await machine.listVolumes({
              filters: JSON.stringify({label: [`namespace=${namespace}`]})
            })).Volumes;
            await Promise.all(foundVolumes.map(volume => machine.getVolume(volume.Name).remove()));
          }
        }
      });
    }

    async function doesImageExist(image: string, tag: string) {
      const images = await machine.listImages({
        filters: JSON.stringify({reference: [`${image}:${tag}`]})
      });
      return images.length > 0;
    }

    function pullImage(image: string, tag: string) {
      return new Promise((resolve, reject) =>
        machine.pull(`${image}:${tag}`, {}, function(err, stream) {
          if (err) {
            if (err.message && err.message.indexOf(`manifest for ${image}`)) {
              reject(new ImageNotFoundError(image, tag));
            } else {
              reject(err);
            }
          } else {
            machine.modem.followProgress(stream, resolve);
          }
        })
      );
    }

    await this.namespace.logger.spin({
      text: `Pulling images.`,
      op: async spinner => {
        const images = [
          {
            image: "spicaengine/api",
            tag: options.version.toString()
          },
          {
            image: "spicaengine/spica",
            tag: options.version.toString()
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
          const exists = await doesImageExist(image.image, image.tag);
          if (exists && options["image-pull-policy"] == "if-not-present") {
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
            pullImage(image.image, image.tag).then(() => increasePulledCount())
          )
        );
      }
    });

    const network: docker.Network = await this.namespace.logger.spin({
      text: `Creating a network named ${networkName}.`,
      op: machine.createNetwork({
        Name: networkName,
        Labels: {namespace}
      })
    });

    async function createMongoDB(instanceIndex: number) {
      const container = await machine.createContainer({
        Image: "mongo:4.2",
        name: `${databaseName}-${instanceIndex}`,
        Cmd: ["--replSet", namespace, "--bind_ip_all"],
        Labels: {namespace},
        HostConfig: {
          RestartPolicy: {
            Name: options.restart ? "unless-stopped" : "no"
          },
          Mounts: [
            {
              Source: `${namespace}-db-${instanceIndex}`,
              Type: "volume",
              Target: "/data/db",
              VolumeOptions: {
                DriverConfig: {
                  Name: "local",
                  Options: {}
                },
                NoCopy: false,
                Labels: {namespace}
              }
            }
          ]
        }
      });
      await network.connect({Container: container.id});
      return container.start();
    }

    const databaseReplicas = Number(options["database-replicas"]);
    await this.namespace.logger.spin({
      text: `Creating database containers (1/${databaseReplicas})`,
      op: async spinner => {
        for (let index = 0; index < databaseReplicas; index++) {
          await createMongoDB(index);
          spinner.text = `Creating database containers (${index + 1}/${databaseReplicas})`;
        }
      }
    });

    await this.namespace.logger.spin({
      text: "Waiting the database containers to become ready.",
      op: async spinner => {
        const replSetConfig = JSON.stringify({
          _id: namespace,
          members: new Array(databaseReplicas).fill(0).map((_, index) => {
            return {_id: index, host: `${databaseName}-${index}`};
          })
        });

        const firstContainer = machine.getContainer(`${databaseName}-0`);

        const initiateReplication = async (reconfig = false) => {
          spinner.text = "Initiating replication between database containers.";
          const result = await (await firstContainer.exec({
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
          }))
            .start()
            .catch(e => e);

          return (await this.streamToBuffer(result.output)).toString();
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

    await this.namespace.logger.spin({
      text: "Waiting for the replica set to become ready.",
      op: async () => {
        const firstContainer = machine.getContainer(`${databaseName}-0`);

        for (let i = 0; i < 15; i++) {
          const exec = await firstContainer.exec({
            Cmd: ["mongo", "admin", "--eval", "rs.status()"],
            AttachStderr: true,
            AttachStdout: true
          });
          const response = await this.streamToBuffer((await exec.start()).output);
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

    await this.namespace.logger.spin({
      text: `Creating spica containers (0/2)`,
      op: async spinner => {
        const client = await machine.createContainer({
          Image: `spicaengine/spica:${options.version}`,
          name: `${namespace}-spica`,
          Env: ["BASE_URL=/spica/"],
          Labels: {namespace},
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
          Image: `spicaengine/api:${options.version}`,
          name: `${namespace}-api`,
          Cmd: args,
          Labels: {namespace},
          ExposedPorts: {"80/tcp": {}},
          HostConfig: {
            RestartPolicy: {
              Name: options.restart ? "unless-stopped" : "no"
            },
            Mounts: [
              {
                Target: "/var/data",
                Source: `${namespace}-api`,
                Type: "volume",
                VolumeOptions: {
                  NoCopy: false,
                  Labels: {namespace},
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

    await this.namespace.logger.spin({
      text: `Creating an ingress to route traffic.`,
      op: async () => {
        const proxy = await machine.createContainer({
          Image: `nginx:latest`,
          name: `${namespace}-ingress`,
          HostConfig: {
            PortBindings: {"80/tcp": [{HostPort: port.toString()}]},
            RestartPolicy: {
              Name: options.restart ? "unless-stopped" : "no"
            }
          },
          Labels: {namespace}
        });
        await network.connect({Container: proxy.id});
        await proxy.start();
        const nginxConfig = `
        upstream ${namespace}-api {
          server ${namespace}-api;
        }
        upstream ${namespace}-spica {
          server ${namespace}-spica;
        }
        server {
          listen       80;
          server_name  localhost;

          location ~ ^/api/?(.*) {
            proxy_pass http://${namespace}-api/$1$is_args$args;
            proxy_set_header Host $host;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_set_header X-Forwarded-Port $server_port;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "Upgrade";
          }
          location ~ ^/spica/?(.*) {
            proxy_pass http://${namespace}-spica/$1$is_args$args;
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
        const {output} = await exec.start();
        await this.streamToBuffer(output);
        await proxy.restart();
      }
    });
    this.namespace.logger.success(`
Spica ${namespace} is serving on ${publicHost}\nOpen your browser on ${publicHost}/spica to login.

Identitifer: spica
Password: ${namespace}
    `);

    if (options.open) {
      await open(`${publicHost}/spica`);
    }
  }

  private streamToBuffer(stream: Stream): Promise<Buffer> {
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
}
