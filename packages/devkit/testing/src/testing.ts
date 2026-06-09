import crypto from "crypto";
import {DockerOrchestrator} from "./docker";
import {api, createClient} from "./http";
import {resourceInstaller} from "./resources";
import {runReset, ResetContext} from "./reset";
import {ResetModule, SpicaInstance, StartOptions, TeardownOptions} from "./interface";

/** Internal connection + credential bundle; never exposed on the public instance. */
interface InstanceInternals {
  name: string;
  url: string;
  mongoUrl: string;
  databaseName: string;
  identifier: string;
  password: string;
}

function buildApiArgs(opts: {
  name: string;
  port: number;
  identifier: string;
  password: string;
  masterKey: string;
  passportSecret: string;
  apiOptions: Record<string, string | number | boolean>;
}): string[] {
  // User-supplied flags first; instance-critical flags after so they win on collision.
  const args = Object.entries(opts.apiOptions).map(([key, value]) => `--${key}=${value}`);
  return [
    ...args,
    `--database-name=${opts.name}`,
    `--database-replica-set=${opts.name}`,
    `--database-uri=mongodb://${opts.name}-db-0`,
    `--public-url=http://localhost:${opts.port}`,
    `--passport-secret=${opts.passportSecret}`,
    `--passport-default-identity-identifier=${opts.identifier}`,
    `--passport-default-identity-password=${opts.password}`,
    `--master-key=${opts.masterKey}`,
    `--persistent-path=/var/data`
  ];
}

class SpicaInstanceImpl implements SpicaInstance {
  /** The only thing a test writer sees — everything else is the test writer's own concern. */
  readonly publicUrl: string;

  private readonly internals: InstanceInternals;
  private readonly orchestrator: DockerOrchestrator;

  constructor(init: {internals: InstanceInternals; orchestrator: DockerOrchestrator}) {
    this.internals = init.internals;
    this.publicUrl = init.internals.url;
    this.orchestrator = init.orchestrator;
  }

  async waitForReady(timeoutMs?: number): Promise<void> {
    const {url, identifier, password} = this.internals;
    await api.awaitReady(url, identifier, password, timeoutMs);
  }

  reset(modules: ResetModule[] = ["all"]): Promise<void> {
    const ctx: ResetContext = {
      databaseName: this.internals.databaseName,
      defaultIdentifier: this.internals.identifier
    };
    return runReset(this.internals.mongoUrl, ctx, modules);
  }

  teardown(options: TeardownOptions = {}): Promise<void> {
    return this.orchestrator.teardown(this.internals.name, options.retainVolumes ?? false);
  }
}

/**
 * Start a disposable Spica instance (single-node mongo replica set + api only) and, unless
 * disabled, install the resources found in `resourcePath` — in one step. The returned handle
 * exposes only `publicUrl` plus `waitForReady`/`reset`/`teardown`; authenticating and acting
 * against the server is the test writer's job (point another devkit at `publicUrl` with the
 * identifier/password passed here, default "spica"/"spica").
 */
export async function start(options: StartOptions = {}): Promise<SpicaInstance> {
  const name = options.name || `spica-test-${crypto.randomBytes(4).toString("hex")}`;
  const version = options.version || "latest";
  const mongoVersion = options.mongoVersion || "8.0";
  const identifier = options.identifier || "spica";
  const password = options.password || "spica";
  const masterKey = options.masterKey || crypto.randomBytes(16).toString("hex");
  const resourcePath = options.resourcePath || "./";
  const imagePullPolicy = options.imagePullPolicy || "if-not-present";
  const installResources = options.installResources !== false;
  const passportSecret = crypto.randomBytes(16).toString("hex");

  // get-port is ESM-only; load it dynamically so the CommonJS build keeps working.
  const getPort = (await import("get-port")).default;
  const [port, mongoPort] = await Promise.all([
    getPort(options.port ? {port: options.port} : undefined),
    getPort()
  ]);
  const url = `http://localhost:${port}`;
  const mongoUrl = `mongodb://localhost:${mongoPort}/?directConnection=true`;

  const orchestrator = new DockerOrchestrator();

  try {
    await orchestrator.ensureImages(version, mongoVersion, imagePullPolicy);
    const network = await orchestrator.createNetwork(name);
    await orchestrator.startMongo(name, mongoVersion, mongoPort, network);
    await orchestrator.initReplicaSet(name);

    const args = buildApiArgs({
      name,
      port,
      identifier,
      password,
      masterKey,
      passportSecret,
      apiOptions: options.apiOptions || {}
    });
    await orchestrator.startApi(name, port, version, args, network);

    // A successful login is the readiness gate (works across api versions). The default
    // identity is granted every *FullAccess policy at bootstrap, so its IDENTITY token is all
    // we need to install resources — no separate api key.
    const token = await api.awaitReady(url, identifier, password, options.readyTimeoutMs ?? 120_000);

    if (installResources) {
      const http = createClient(url, `IDENTITY ${token}`);
      await resourceInstaller.install(http, resourcePath);
    }

    return new SpicaInstanceImpl({
      internals: {name, url, mongoUrl, databaseName: name, identifier, password},
      orchestrator
    });
  } catch (error) {
    // Never leak a half-started instance.
    await orchestrator.teardown(name, false).catch(teardownErr =>
      console.warn(`[spica/testing] cleanup teardown failed: ${teardownErr}`)
    );
    throw error;
  }
}
