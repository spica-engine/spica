import {Readable} from "stream";
import {DockerOrchestrator, ImageNotFoundError} from "../src/docker";

function streamOf(text: string): Readable {
  return Readable.from([Buffer.from(text)]);
}

/**
 * Builds a fake exec whose output depends on the command, so initReplicaSet/waitReplicaPrimary
 * see a believable mongo shell, a successful rs.initiate, and a PRIMARY rs.status.
 */
function makeExec(calls: any[]) {
  return jest.fn(async (spec: any) => {
    calls.push(spec);
    const cmd = (spec.Cmd || []).join(" ");
    let out = "";
    if (cmd.includes("command -v mongosh")) out = "/usr/bin/mongosh";
    else if (cmd.includes("rs.initiate")) out = "{ ok: 1 }";
    else if (cmd.includes("rs.status")) out = "{ ok: 1, members: [ { stateStr: 'PRIMARY' } ] }";
    return {start: async () => streamOf(out)};
  });
}

function makeContainer(execCalls: any[], id = "cid") {
  return {
    id,
    start: jest.fn().mockResolvedValue(undefined),
    exec: makeExec(execCalls),
    remove: jest.fn().mockResolvedValue(undefined)
  };
}

function makeFakeDocker() {
  const execCalls: any[] = [];
  const createdContainers: any[] = [];
  const network = {connect: jest.fn().mockResolvedValue(undefined), remove: jest.fn()};

  const docker: any = {
    execCalls,
    createdContainers,
    network,
    listImages: jest.fn().mockResolvedValue([]),
    pull: jest.fn((ref: string, opts: any, cb: any) => cb(null, streamOf(""))),
    modem: {followProgress: jest.fn((_stream: any, cb: any) => cb(null, []))},
    createNetwork: jest.fn().mockResolvedValue(network),
    createContainer: jest.fn(async (config: any) => {
      const c = makeContainer(execCalls, `${config.name}-id`);
      createdContainers.push({config, container: c});
      return c;
    }),
    getContainer: jest.fn(() => makeContainer(execCalls)),
    listContainers: jest.fn().mockResolvedValue([]),
    listNetworks: jest.fn().mockResolvedValue([]),
    listVolumes: jest.fn().mockResolvedValue({Volumes: []}),
    getNetwork: jest.fn(() => ({remove: jest.fn().mockResolvedValue(undefined)})),
    getVolume: jest.fn(() => ({remove: jest.fn().mockResolvedValue(undefined)}))
  };
  return docker;
}

describe("DockerOrchestrator", () => {
  let docker: any;
  let orchestrator: DockerOrchestrator;

  beforeEach(() => {
    docker = makeFakeDocker();
    orchestrator = new DockerOrchestrator(docker);
  });

  describe("ensureImages", () => {
    it("pulls only api and mongo - never panel or nginx", async () => {
      await orchestrator.ensureImages("latest", "8.0", "if-not-present");
      const pulled = docker.pull.mock.calls.map((c: any[]) => c[0]);
      expect(pulled).toEqual(["spicaengine/api:latest", "mongo:8.0"]);
    });

    it("skips present images under if-not-present", async () => {
      docker.listImages.mockResolvedValue([{Id: "x"}]);
      await orchestrator.ensureImages("latest", "8.0", "if-not-present");
      expect(docker.pull).not.toHaveBeenCalled();
    });

    it("always pulls under 'always'", async () => {
      docker.listImages.mockResolvedValue([{Id: "x"}]);
      await orchestrator.ensureImages("latest", "8.0", "always");
      expect(docker.pull).toHaveBeenCalledTimes(2);
    });

    it("maps a missing manifest to ImageNotFoundError", async () => {
      docker.pull.mockImplementation((_ref: string, _o: any, cb: any) =>
        cb(new Error("manifest for spicaengine/api not found"))
      );
      await expect(orchestrator.ensureImages("nope", "8.0", "always")).rejects.toBeInstanceOf(
        ImageNotFoundError
      );
    });
  });

  describe("startMongo", () => {
    it("configures a labeled single-node replica member with the 27017 port published", async () => {
      const network = await orchestrator.createNetwork("inst");
      await orchestrator.startMongo("inst", "8.0", 27099, network);

      const {config} = docker.createdContainers.find((c: any) => c.config.name === "inst-db-0");
      expect(config.Image).toBe("mongo:8.0");
      expect(config.Cmd).toEqual(["--replSet", "inst", "--bind_ip_all"]);
      expect(config.Labels).toEqual({namespace: "inst"});
      expect(config.HostConfig.PortBindings).toEqual({"27017/tcp": [{HostPort: "27099"}]});
      expect(config.HostConfig.Mounts[0].Source).toBe("inst-db-0");
      expect(network.connect).toHaveBeenCalledWith({Container: "inst-db-0-id"});
    });
  });

  describe("initReplicaSet", () => {
    it("initiates a single member by its in-network hostname and waits for PRIMARY", async () => {
      await orchestrator.initReplicaSet("inst");

      const initiate = docker.execCalls.find((c: any) =>
        (c.Cmd || []).join(" ").includes("rs.initiate")
      );
      const evalArg = initiate.Cmd[initiate.Cmd.length - 1];
      expect(evalArg).toContain('"host":"inst-db-0"');
      expect(evalArg).toContain('"_id":"inst"');

      // detected shell is used (mongosh), and rs.status() was polled
      expect(docker.execCalls.some((c: any) => (c.Cmd || []).includes("mongosh"))).toBe(true);
      expect(
        docker.execCalls.some((c: any) => (c.Cmd || []).join(" ").includes("rs.status"))
      ).toBe(true);
    });

    it("rejects when initiation never returns ok", async () => {
      docker.getContainer = jest.fn(() => ({
        exec: jest.fn(async (spec: any) => {
          const cmd = (spec.Cmd || []).join(" ");
          const out = cmd.includes("command -v") ? "/usr/bin/mongosh" : "some error";
          return {start: async () => streamOf(out)};
        })
      }));
      await expect(orchestrator.initReplicaSet("inst")).rejects.toThrow(/Failed to initiate/);
    });
  });

  describe("startApi", () => {
    it("publishes port 80 to the host and passes the flag array", async () => {
      const network = await orchestrator.createNetwork("inst");
      const args = ["--database-name=inst", "--public-url=http://localhost:4500"];
      await orchestrator.startApi("inst", 4500, "latest", args, network);

      const {config} = docker.createdContainers.find((c: any) => c.config.name === "inst-api");
      expect(config.Image).toBe("spicaengine/api:latest");
      expect(config.Cmd).toBe(args);
      expect(config.ExposedPorts).toEqual({"80/tcp": {}});
      expect(config.HostConfig.PortBindings).toEqual({"80/tcp": [{HostPort: "4500"}]});
      expect(config.HostConfig.Mounts[0].Target).toBe("/var/data");
    });
  });

  it("creates exactly two containers (mongo + api) for a full bring-up - no panel, no nginx", async () => {
    const network = await orchestrator.createNetwork("inst");
    await orchestrator.startMongo("inst", "8.0", 27099, network);
    await orchestrator.startApi("inst", 4500, "latest", [], network);
    expect(docker.createContainer).toHaveBeenCalledTimes(2);
  });

  describe("teardown", () => {
    it("removes containers, networks and volumes by namespace label", async () => {
      docker.listContainers.mockResolvedValue([{Id: "c1"}, {Id: "c2"}]);
      docker.listNetworks.mockResolvedValue([{Id: "n1"}]);
      docker.listVolumes.mockResolvedValue({Volumes: [{Name: "v1"}]});
      const containerRemove = jest.fn().mockResolvedValue(undefined);
      docker.getContainer = jest.fn(() => ({remove: containerRemove}));
      const networkRemove = jest.fn().mockResolvedValue(undefined);
      docker.getNetwork = jest.fn(() => ({remove: networkRemove}));
      const volumeRemove = jest.fn().mockResolvedValue(undefined);
      docker.getVolume = jest.fn(() => ({remove: volumeRemove}));

      await orchestrator.teardown("inst", false);

      const filter = JSON.stringify({label: ["namespace=inst"]});
      expect(docker.listContainers).toHaveBeenCalledWith({all: true, filters: filter});
      expect(containerRemove).toHaveBeenCalledWith({v: true, force: true});
      expect(containerRemove).toHaveBeenCalledTimes(2);
      expect(networkRemove).toHaveBeenCalledTimes(1);
      expect(volumeRemove).toHaveBeenCalledTimes(1);
    });

    it("keeps volumes when retainVolumes is true", async () => {
      docker.listContainers.mockResolvedValue([]);
      docker.listNetworks.mockResolvedValue([]);
      await orchestrator.teardown("inst", true);
      expect(docker.listVolumes).not.toHaveBeenCalled();
    });
  });
});
