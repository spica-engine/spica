import {start} from "../src/testing";
import {DockerOrchestrator} from "../src/docker";
import {api} from "../src/http";
import {resourceInstaller} from "../src/resources";

describe("start", () => {
  let order: string[];

  beforeEach(() => {
    order = [];
    const track = (label: string) =>
      jest.fn(async () => {
        order.push(label);
      });

    jest.spyOn(DockerOrchestrator.prototype, "ensureImages").mockImplementation(track("ensureImages"));
    jest
      .spyOn(DockerOrchestrator.prototype, "createNetwork")
      .mockImplementation(async () => {
        order.push("createNetwork");
        return {} as any;
      });
    jest.spyOn(DockerOrchestrator.prototype, "startMongo").mockImplementation(track("startMongo"));
    jest
      .spyOn(DockerOrchestrator.prototype, "initReplicaSet")
      .mockImplementation(track("initReplicaSet"));
    jest.spyOn(DockerOrchestrator.prototype, "startApi").mockImplementation(track("startApi"));
    jest.spyOn(DockerOrchestrator.prototype, "teardown").mockResolvedValue(undefined);

    jest.spyOn(api, "awaitReady").mockResolvedValue("tok123");
    jest
      .spyOn(api, "createApiKey")
      .mockResolvedValue({_id: "k1", name: "e2e", key: "secret-key"});
    jest.spyOn(resourceInstaller, "install").mockResolvedValue({errors: []});
  });

  afterEach(() => jest.restoreAllMocks());

  it("returns a handle with host-reachable urls (no /api suffix) and credentials", async () => {
    const instance = await start({name: "inst", installResources: false});

    expect(instance.name).toBe("inst");
    expect(instance.databaseName).toBe("inst");
    expect(instance.url).toMatch(/^http:\/\/localhost:\d+$/);
    expect(instance.url).not.toContain("/api");
    expect(instance.publicUrl).toBe(instance.url);
    expect(instance.mongoUrl).toMatch(/^mongodb:\/\/localhost:\d+\/\?directConnection=true$/);
    expect(instance.token).toBe("tok123");
    expect(instance.identifier).toBe("spica");
    expect(instance.apikey).toEqual({_id: "k1", name: "e2e", key: "secret-key"});
    expect(instance.initializeOptionsIdentity()).toEqual({
      identity: "tok123",
      publicUrl: instance.url
    });
    expect(instance.initializeOptionsApikey()).toEqual({
      apikey: "secret-key",
      publicUrl: instance.url
    });
  });

  it("brings the stack up in the correct order", async () => {
    await start({name: "inst", installResources: false});
    expect(order).toEqual([
      "ensureImages",
      "createNetwork",
      "startMongo",
      "initReplicaSet",
      "startApi"
    ]);
  });

  it("passes the instance-critical api flags with the no-/api public url", async () => {
    const instance = await start({name: "inst", installResources: false});
    const args: string[] = (DockerOrchestrator.prototype.startApi as jest.Mock).mock.calls[0][3];

    expect(args).toContain("--database-name=inst");
    expect(args).toContain("--database-replica-set=inst");
    expect(args).toContain("--database-uri=mongodb://inst-db-0");
    expect(args).toContain(`--public-url=${instance.url}`);
    expect(args).toContain("--passport-default-identity-identifier=spica");
    expect(args).toContain("--passport-default-identity-password=spica");
    expect(args).toContain("--persistent-path=/var/data");
  });

  it("lets instance-critical flags win over colliding apiOptions", async () => {
    await start({
      name: "inst",
      installResources: false,
      apiOptions: {"database-uri": "mongodb://evil", "activity-stream": false}
    });
    const args: string[] = (DockerOrchestrator.prototype.startApi as jest.Mock).mock.calls[0][3];

    // user flag is present but the base one comes after it (yargs: later wins)
    expect(args.indexOf("--database-uri=mongodb://evil")).toBeLessThan(
      args.indexOf("--database-uri=mongodb://inst-db-0")
    );
    expect(args).toContain("--activity-stream=false");
  });

  it("logs in as the default identity and creates a full-access api key", async () => {
    const instance = await start({name: "inst", installResources: false});
    expect(api.awaitReady).toHaveBeenCalledWith(
      instance.url,
      "spica",
      "spica",
      expect.any(Number)
    );
    expect(api.createApiKey).toHaveBeenCalledWith(expect.anything(), "e2e", {fullAccess: true});
  });

  it("installs resources by default with the same authenticated client", async () => {
    await start({name: "inst", resourcePath: "./fixtures"});
    const installArgs = (resourceInstaller.install as jest.Mock).mock.calls[0];
    const apikeyClient = (api.createApiKey as jest.Mock).mock.calls[0][0];
    expect(installArgs[0]).toBe(apikeyClient); // same unwrapping client
    expect(installArgs[1]).toBe("./fixtures");
  });

  it("skips resource install when installResources is false", async () => {
    await start({name: "inst", installResources: false});
    expect(resourceInstaller.install).not.toHaveBeenCalled();
  });

  it("tears the half-started instance down and rethrows on failure", async () => {
    (api.awaitReady as jest.Mock).mockRejectedValue(new Error("api never came up"));
    await expect(start({name: "inst", installResources: false})).rejects.toThrow(
      "api never came up"
    );
    expect(DockerOrchestrator.prototype.teardown).toHaveBeenCalledWith("inst", false);
  });
});
