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
          name: "restart",
          type: Boolean,
          summary: "Restart failed containers if exits unexpectedly.",
          default: true
        }
      ]
    };
  }

  async run([namespace]: string[], options: CommandLineOptions): Promise<void> {
    const machine = new docker();

    const networkName = `${namespace}-network`,
      databaseName = `${namespace}-db`,
      port = await getport({port: parseInt(options.port.toString())}),
      publicHost = `http://localhost:${port}`;

    if (options.port.toString() != port.toString() && options.port != "4500") {
      this.namespace.logger.info(
        `Port ${options.port} already in use, the port ${port} will be used instead.`
      );
    }

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
        text: "Shutting down and removing the previous containers and networks.",
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
        }
      });
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
      text: `Pulling images (0/4)`,
      op: async spinner => {
        let pulled = 0;
        function increasePulledCount() {
          pulled++;
          spinner.text = `Pulling images (${pulled}/4)`;
        }
        return Promise.all([
          pullImage("spicaengine/api", options.version.toString()).then(() =>
            increasePulledCount()
          ),
          pullImage("spicaengine/spica", options.version.toString()).then(() =>
            increasePulledCount()
          ),
          pullImage("mongo", "4.2").then(() => increasePulledCount()),
          pullImage("nginx", "latest").then(() => increasePulledCount())
        ]);
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
          }
        }
      });
      await network.connect({Container: container.id});
      return container.start();
    }

    await this.namespace.logger.spin({
      text: `Creating database containers (1/3)`,
      op: async spinner => {
        await createMongoDB(0);
        spinner.text = `Creating database containers (2/3)`;
        await createMongoDB(1);
        spinner.text = `Creating database containers (3/3)`;
        await createMongoDB(2);
      }
    });

    await this.namespace.logger.spin({
      text: "Waiting the database containers to become ready.",
      op: async spinner => {
        await new Promise(resolve => setTimeout(resolve, 2000));
        spinner.text = "Initiating replication between database containers.";
        const replSet = `rs.initiate({
          _id: "${namespace}",
          members: [
            { _id: 0, host : "${databaseName}-0" },
            { _id: 1, host : "${databaseName}-1" },
            { _id: 2, host : "${databaseName}-2", priority : 0, slaveDelay: 5, tags: { slaveDelay: "true" } }
          ]
        })`;
        const firstContainer = machine.getContainer(`${databaseName}-0`);
        const exec = await firstContainer.exec({
          Cmd: ["mongo", "admin", "--eval", replSet],
          AttachStderr: true,
          AttachStdout: true
        });

        const output = await this.streamToBuffer((await exec.start()).output);
        if (output.toString().indexOf('"ok" : 1') == -1) {
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
          Env: [
            "PORT=80",
            `DATABASE_NAME=${namespace}`,
            `REPLICA_SET=${namespace}`,
            `PUBLIC_HOST=${publicHost}/api`,
            `DEFAULT_PASSWORD=${namespace}`,
            `PERSISTENT_PATH=/tmp`,
            `SECRET="${namespace}"`,
            `DATABASE_URI="mongodb://${databaseName}-0,${databaseName}-1,${databaseName}-2"`
          ],
          Labels: {namespace},
          HostConfig: {
            RestartPolicy: {
              Name: options.restart ? "unless-stopped" : "no"
            }
          }
        });
        await network.connect({Container: api.id});
        await api.start();
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
          }
          location ~ ^/spica/?(.*) {
            proxy_pass http://${namespace}-spica/$1$is_args$args;
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
      stream.on("data", chunk => response.push(chunk));
      stream.on("end", () => resolve(Buffer.concat(response)));
    });
  }
}
