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
    jest.spyOn(resourceInstaller, "install").mockResolvedValue({errors: []});
  });

  afterEach(() => jest.restoreAllMocks());

  it("exposes only publicUrl (no /api suffix) and no credentials", async () => {
    const instance = await start({name: "inst", installResources: false});

    expect(instance.publicUrl).toMatch(/^http:\/\/localhost:\d+$/);
    expect(instance.publicUrl).not.toContain("/api");

    // none of the internal connection details / credentials are part of the public surface
    expect((instance as any).token).toBeUndefined();
    expect((instance as any).apikey).toBeUndefined();
    expect((instance as any).identifier).toBeUndefined();
    expect((instance as any).mongoUrl).toBeUndefined();

    // the lifecycle methods are the rest of the surface
    expect(typeof instance.waitForReady).toBe("function");
    expect(typeof instance.reset).toBe("function");
    expect(typeof instance.teardown).toBe("function");
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
    expect(args).toContain(`--public-url=${instance.publicUrl}`);
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

  it("uses the default identity as the readiness gate (no api key is created)", async () => {
    const instance = await start({name: "inst", installResources: false});
    expect(api.awaitReady).toHaveBeenCalledWith(
      instance.publicUrl,
      "spica",
      "spica",
      expect.any(Number)
    );
  });

  it("installs resources with a client authenticated by the default identity's token", async () => {
    await start({name: "inst", resourcePath: "./fixtures"});

    const installArgs = (resourceInstaller.install as jest.Mock).mock.calls[0];
    const client: any = installArgs[0];
    // the install client carries the IDENTITY token returned by awaitReady — not an api key
    expect(client.defaults.headers.common["Authorization"]).toBe("IDENTITY tok123");
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
