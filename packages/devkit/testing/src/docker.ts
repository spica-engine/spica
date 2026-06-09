import Docker from "dockerode";
import {Stream} from "stream";
import {ImagePullPolicy} from "./interface";

function streamToBuffer(stream: Stream): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on("data", chunk => chunks.push(chunk));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
}

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

export class ImageNotFoundError extends Error {
  constructor(image: string, tag: string) {
    super(`Could not find the image ${image}:${tag}.`);
  }
}

/**
 * Minimal docker orchestration for a disposable Spica instance: a single-node mongo
 * replica set plus the api container only (no panel, no nginx). Every resource is
 * labeled `namespace=<name>` so teardown can remove the whole instance in one sweep.
 *
 * The dockerode instance is injectable so the orchestration can be unit-tested with a
 * fake docker rather than a real daemon.
 */
export class DockerOrchestrator {
  constructor(private docker: Docker = new Docker()) {}

  private label(name: string) {
    return {namespace: name};
  }

  private labelFilter(name: string) {
    return JSON.stringify({label: [`namespace=${name}`]});
  }

  async doesImageExist(image: string, tag: string): Promise<boolean> {
    const images = await this.docker.listImages({
      filters: JSON.stringify({reference: [`${image}:${tag}`]})
    });
    return images.length > 0;
  }

  pullImage(image: string, tag: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.docker.pull(`${image}:${tag}`, {}, (err, stream) => {
        if (err) {
          if (err.message && err.message.indexOf(`manifest for ${image}`) !== -1) {
            reject(new ImageNotFoundError(image, tag));
          } else {
            reject(err);
          }
          return;
        }
        this.docker.modem.followProgress(stream, followErr =>
          followErr ? reject(followErr) : resolve()
        );
      });
    });
  }

  async ensureImages(
    version: string,
    mongoVersion: string,
    policy: ImagePullPolicy
  ): Promise<void> {
    const images = [
      {image: "spicaengine/api", tag: version},
      {image: "mongo", tag: mongoVersion}
    ];
    await Promise.all(
      images.map(async ({image, tag}) => {
        if (policy === "if-not-present" && (await this.doesImageExist(image, tag))) return;
        await this.pullImage(image, tag);
      })
    );
  }

  async createNetwork(name: string): Promise<Docker.Network> {
    return this.docker.createNetwork({Name: `${name}-network`, Labels: this.label(name)});
  }

  /** Start the single mongo node and publish its 27017 port to `mongoPort` on the host. */
  async startMongo(
    name: string,
    mongoVersion: string,
    mongoPort: number,
    network: Docker.Network
  ): Promise<void> {
    const container = await this.docker.createContainer({
      Image: `mongo:${mongoVersion}`,
      name: `${name}-db-0`,
      Cmd: ["--replSet", name, "--bind_ip_all"],
      Labels: this.label(name),
      ExposedPorts: {"27017/tcp": {}},
      HostConfig: {
        PortBindings: {"27017/tcp": [{HostPort: String(mongoPort)}]},
        Mounts: [
          {
            Source: `${name}-db-0`,
            Type: "volume",
            Target: "/data/db",
            VolumeOptions: {
              NoCopy: false,
              Labels: this.label(name),
              DriverConfig: {Name: "local", Options: {}}
            }
          }
        ]
      }
    });
    await network.connect({Container: container.id});
    await container.start();
  }

  /** Detect the available mongo shell inside the db container (mongosh preferred). */
  private async detectShell(container: Docker.Container): Promise<string> {
    const probe = await container.exec({
      Cmd: ["sh", "-c", "command -v mongosh || command -v mongo || true"],
      AttachStdout: true,
      AttachStderr: true
    });
    const out = (await streamToBuffer(await probe.start({}))).toString().trim();
    if (!out) {
      throw new Error("No mongo shell (mongosh/mongo) available inside the database container.");
    }
    return out.split("/").pop() as string;
  }

  /** Initiate a single-member replica set and wait until the node is PRIMARY. */
  async initReplicaSet(name: string): Promise<void> {
    const container = this.docker.getContainer(`${name}-db-0`);
    const shell = await this.detectShell(container);

    const replSetConfig = JSON.stringify({
      _id: name,
      members: [{_id: 0, host: `${name}-db-0`}]
    });

    const run = async (reconfig: boolean): Promise<string> => {
      const exec = await container.exec({
        Cmd: [
          shell,
          "admin",
          "--eval",
          reconfig
            ? `rs.reconfig(${replSetConfig}, { force: true })`
            : `rs.initiate(${replSetConfig})`
        ],
        AttachStdout: true,
        AttachStderr: true
      });
      return (await streamToBuffer(await exec.start({}))).toString();
    };

    const TRANSIENT_ERRORS = ["ECONNREFUSED", "ECONNRESET", "MongoNetworkError"];
    let output = await run(false);
    for (let retry = 0; retry < 5 && TRANSIENT_ERRORS.some(s => output.includes(s)); retry++) {
      await sleep(1000);
      output = await run(false);
    }
    if (output.indexOf("already initialized") !== -1) {
      output = await run(true);
    }
    if (output.indexOf("ok: 1") === -1) {
      throw new Error(`Failed to initiate replica set: ${output}`);
    }

    await this.waitReplicaPrimary(name, shell);
  }

  private async waitReplicaPrimary(name: string, shell: string): Promise<void> {
    const container = this.docker.getContainer(`${name}-db-0`);
    for (let i = 0; i < 15; i++) {
      const exec = await container.exec({
        Cmd: [shell, "admin", "--eval", "rs.status()"],
        AttachStdout: true,
        AttachStderr: true
      });
      const out = (await streamToBuffer(await exec.start({}))).toString();
      if (out.indexOf("ok: 1") !== -1 && out.indexOf("stateStr: 'PRIMARY'") !== -1) {
        return;
      }
      await sleep(2000);
    }
    throw new Error("Replica set did not become ready in 30 seconds.");
  }

  /** Start the api container, publishing its port 80 directly to `port` on the host. */
  async startApi(
    name: string,
    port: number,
    version: string,
    args: string[],
    network: Docker.Network
  ): Promise<void> {
    const container = await this.docker.createContainer({
      Image: `spicaengine/api:${version}`,
      name: `${name}-api`,
      Cmd: args,
      Labels: this.label(name),
      ExposedPorts: {"80/tcp": {}},
      HostConfig: {
        PortBindings: {"80/tcp": [{HostPort: String(port)}]},
        Mounts: [
          {
            Target: "/var/data",
            Source: `${name}-api`,
            Type: "volume",
            VolumeOptions: {
              NoCopy: false,
              Labels: this.label(name),
              DriverConfig: {Name: "local", Options: {}}
            }
          }
        ]
      }
    });
    await network.connect({Container: container.id});
    await container.start();
  }

  /** Remove every container, network and (unless retained) volume of the instance. */
  async teardown(name: string, retainVolumes = false): Promise<void> {
    const filters = this.labelFilter(name);

    const containers = await this.docker.listContainers({all: true, filters});
    const cResults = await Promise.allSettled(
      containers.map(info => this.docker.getContainer(info.Id).remove({v: true, force: true}))
    );
    const cFails = cResults.filter(r => r.status === "rejected").length;
    if (cFails) console.warn(`[spica/testing] teardown(${name}): ${cFails} container removal(s) failed`);

    const networks = await this.docker.listNetworks({filters});
    const nResults = await Promise.allSettled(
      networks.map(info => this.docker.getNetwork(info.Id).remove())
    );
    const nFails = nResults.filter(r => r.status === "rejected").length;
    if (nFails) console.warn(`[spica/testing] teardown(${name}): ${nFails} network removal(s) failed`);

    if (!retainVolumes) {
      const {Volumes = []} = await this.docker.listVolumes({filters});
      const vResults = await Promise.allSettled(
        Volumes.map(vol => this.docker.getVolume(vol.Name).remove())
      );
      const vFails = vResults.filter(r => r.status === "rejected").length;
      if (vFails) console.warn(`[spica/testing] teardown(${name}): ${vFails} volume removal(s) failed`);
    }
  }
}
