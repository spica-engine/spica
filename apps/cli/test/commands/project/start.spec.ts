import {Readable} from "stream";
import {create} from "../../../src/commands/project/start.js";
import {DockerMachine} from "../../../src/project.js";

type FakeContainer = {
  id: string;
  name: string;
  spec: any;
  start: jest.Mock;
  restart: jest.Mock;
  exec: jest.Mock;
};

function streamOf(text: string) {
  return Readable.from([Buffer.from(text)]);
}

/**
 * `DockerMachine` is a singleton by construction: its constructor returns the first instance ever
 * created. So the machine `create()` builds inside itself is this one, and stubbing the methods here is
 * enough — no module mocking, no docker daemon, nothing pulled.
 */
function stubMachine() {
  const machine = new DockerMachine() as any;
  const containers: FakeContainer[] = [];
  const network = {connect: jest.fn().mockResolvedValue(undefined), Id: "network-id"};

  const execFor = (container: FakeContainer) =>
    jest.fn(async ({Cmd}: {Cmd: string[]}) => {
      const command = Cmd.join(" ");
      let output = "";
      if (command.includes("command -v mongosh")) output = "/usr/bin/mongosh";
      else if (command.includes("pg_isready"))
        output = "/var/run/postgresql:5432 - accepting connections";
      else if (command.includes("rs.status()")) output = "ok: 1\nstateStr: 'PRIMARY'";
      else if (command.includes("rs.initiate")) output = "ok: 1";
      return {start: jest.fn().mockResolvedValue(streamOf(output))};
    });

  machine.listNetworks = jest.fn().mockResolvedValue([]);
  machine.listContainers = jest.fn().mockResolvedValue([]);
  machine.listVolumes = jest.fn().mockResolvedValue({Volumes: []});
  machine.doesImageExist = jest.fn().mockResolvedValue(true);
  machine.pullImage = jest.fn().mockResolvedValue(undefined);
  machine.createNetwork = jest.fn().mockResolvedValue(network);

  machine.createContainer = jest.fn(async (spec: any) => {
    const container: FakeContainer = {
      id: `${spec.name}-id`,
      name: spec.name,
      spec,
      start: jest.fn().mockResolvedValue(undefined),
      restart: jest.fn().mockResolvedValue(undefined),
      exec: undefined as any
    };
    container.exec = execFor(container);
    containers.push(container);
    return container;
  });

  machine.getContainer = jest.fn((name: string) => containers.find(c => c.name === name));

  return {
    machine,
    containers,
    network,
    imageOf: (prefix: string) => containers.filter(c => c.spec.Image.startsWith(prefix)),
    apiArgs: () => containers.find(c => c.name.endsWith("-api"))!.spec.Cmd as string[]
  };
}

function optionsFor(overrides: Record<string, any> = {}) {
  return {
    port: 4500,
    imageVersion: "latest",
    database: "mongodb",
    mongoVersion: "8.0",
    postgresVersion: "16",
    imagePullPolicy: "if-not-present",
    retainVolumes: true,
    restart: true,
    databaseReplicas: "1",
    ...overrides
  };
}

const run = (name: string, overrides?: Record<string, any>) =>
  create({args: {name}, options: optionsFor(overrides)} as any);

describe("project start", () => {
  let docker: ReturnType<typeof stubMachine>;
  let info: jest.SpyInstance;

  beforeEach(() => {
    docker = stubMachine();
    info = jest.spyOn(console, "info").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("--database=postgres", () => {
    it("should create a single postgres container and no mongo container", async () => {
      await run("pgproject", {database: "postgres"});

      expect(docker.imageOf("mongo:")).toEqual([]);

      const postgres = docker.imageOf("postgres:");
      expect(postgres.length).toEqual(1);
      expect(postgres[0].name).toEqual("pgproject-db-0");
      expect(postgres[0].spec.Image).toEqual("postgres:16");
      expect(postgres[0].spec.Env).toEqual([
        "POSTGRES_USER=spica",
        "POSTGRES_PASSWORD=spica",
        "POSTGRES_DB=pgproject",
        "PGDATA=/var/lib/postgresql/data/pgdata"
      ]);
      expect(postgres[0].spec.HostConfig.Mounts[0].Target).toEqual("/var/lib/postgresql/data");
    });

    it("should pull the postgres image instead of the mongo one", async () => {
      docker.machine.doesImageExist.mockResolvedValue(false);

      await run("pgproject", {database: "postgres"});

      const pulled = docker.machine.pullImage.mock.calls.map(([image]) => image);
      expect(pulled).toContain("postgres");
      expect(pulled).not.toContain("mongo");
    });

    it("should wait with pg_isready and never run a replica set command", async () => {
      await run("pgproject", {database: "postgres"});

      const commands = docker
        .imageOf("postgres:")[0]
        .exec.mock.calls.map(([{Cmd}]) => Cmd.join(" "));

      expect(commands.some(command => command.includes("pg_isready"))).toEqual(true);
      expect(commands.some(command => command.includes("rs."))).toEqual(false);
    });

    it("should pass the postgres uri and a listen uri to the api, without a replica set", async () => {
      await run("pgproject", {database: "postgres"});

      const args = docker.apiArgs();
      const uri = "postgres://spica:spica@pgproject-db-0:5432/pgproject";

      expect(args).toContain(`--database-uri="${uri}"`);
      expect(args).toContain(`--database-listen-uri="${uri}"`);
      expect(args).toContain("--database-name=pgproject");
      expect(args.some(arg => arg.startsWith("--database-replica-set"))).toEqual(false);
    });

    it("should ignore --database-replicas and say so", async () => {
      await run("pgproject", {database: "postgres", databaseReplicas: "3"});

      expect(docker.imageOf("postgres:").length).toEqual(1);
      expect(
        info.mock.calls.some(([message]) =>
          String(message).includes("--database-replicas is ignored on postgres")
        )
      ).toEqual(true);
    });
  });

  describe("default backend", () => {
    it("should still create mongo containers and a replica set uri", async () => {
      await run("mgproject", {databaseReplicas: "3"});

      expect(docker.imageOf("postgres:")).toEqual([]);
      expect(docker.imageOf("mongo:").map(container => container.name)).toEqual([
        "mgproject-db-0",
        "mgproject-db-1",
        "mgproject-db-2"
      ]);

      const args = docker.apiArgs();
      expect(args).toContain("--database-replica-set=mgproject");
      expect(args).toContain(
        '--database-uri="mongodb://mgproject-db-0,mgproject-db-1,mgproject-db-2"'
      );
      expect(args.some(arg => arg.startsWith("--database-listen-uri"))).toEqual(false);
    });
  });
});
