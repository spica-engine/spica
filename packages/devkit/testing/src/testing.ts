import crypto from "crypto";
import {DockerOrchestrator} from "./docker";
import {api, createClient, HttpClient} from "./http";
import {resourceInstaller} from "./resources";
import {runReset, ResetContext} from "./reset";
import {
  ApiKeyInfo,
  CreateApiKeyOptions,
  ResetModule,
  SpicaInstance,
  SpicaInstanceInfo,
  StartOptions,
  TeardownOptions
} from "./interface";

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
  name: string;
  url: string;
  publicUrl: string;
  mongoUrl: string;
  databaseName: string;
  token: string;
  identifier: string;
  password: string;
  apikey: ApiKeyInfo;

  private http: HttpClient;
  private orchestrator: DockerOrchestrator;
  private resourcePath: string;

  constructor(init: {
    info: SpicaInstanceInfo;
    http: HttpClient;
    orchestrator: DockerOrchestrator;
    resourcePath: string;
  }) {
    Object.assign(this, init.info);
    this.http = init.http;
    this.orchestrator = init.orchestrator;
    this.resourcePath = init.resourcePath;
  }

  initializeOptionsIdentity() {
    return {identity: this.token, publicUrl: this.publicUrl};
  }

  initializeOptionsApikey() {
    return {apikey: this.apikey.key, publicUrl: this.publicUrl};
  }

  loginAs(identifier: string, password: string, expires?: number): Promise<string> {
    return api.login(this.url, identifier, password, expires);
  }

  createApiKey(name: string, options?: CreateApiKeyOptions): Promise<ApiKeyInfo> {
    return api.createApiKey(this.http, name, options);
  }

  async waitForReady(timeoutMs?: number): Promise<void> {
    await api.awaitReady(this.url, this.identifier, this.password, timeoutMs);
  }

  installResources(resourcePath = this.resourcePath): Promise<{errors: string[]}> {
    return resourceInstaller.install(this.http, resourcePath);
  }

  reset(modules: ResetModule[] = ["all"]): Promise<void> {
    const ctx: ResetContext = {
      databaseName: this.databaseName,
      defaultIdentifier: this.identifier,
      apikeyId: this.apikey._id
    };
    return runReset(this.mongoUrl, ctx, modules);
  }

  teardown(options: TeardownOptions = {}): Promise<void> {
    return this.orchestrator.teardown(this.name, options.retainVolumes ?? false);
  }
}

/**
 * Start a disposable Spica instance (single-node mongo replica set + api only), install
 * the resources found in `resourcePath`, and return a handle carrying everything needed to
 * point the other devkit packages at it.
 */
export async function start(options: StartOptions = {}): Promise<SpicaInstance> {
  const name = options.name || `spica-test-${crypto.randomBytes(4).toString("hex")}`;
  const version = options.version || "latest";
  const mongoVersion = options.mongoVersion || "8.0";
  const identifier = options.identifier || "spica";
  const password = options.password || "spica";
  const masterKey = options.masterKey || name;
  const resourcePath = options.resourcePath || "./";
  const imagePullPolicy = options.imagePullPolicy || "if-not-present";
  const installResources = options.installResources !== false;
  const passportSecret = crypto.randomBytes(16).toString("hex");

  // get-port is ESM-only; load it dynamically so the CommonJS build keeps working.
  const getPort = (await import("get-port")).default;
  const port = await getPort(options.port ? {port: options.port} : undefined);
  const mongoPort = await getPort();
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

    // A successful login is the readiness gate (works across api versions).
    const token = await api.awaitReady(url, identifier, password, options.readyTimeoutMs ?? 120_000);
    const http = createClient(url, `IDENTITY ${token}`);
    const apikey = await api.createApiKey(http, "e2e", {fullAccess: true});

    const instance = new SpicaInstanceImpl({
      info: {
        name,
        url,
        publicUrl: url,
        mongoUrl,
        databaseName: name,
        token,
        identifier,
        password,
        apikey
      },
      http,
      orchestrator,
      resourcePath
    });

    if (installResources) {
      await instance.installResources(resourcePath);
    }

    return instance;
  } catch (error) {
    // Never leak a half-started instance.
    await orchestrator.teardown(name, false).catch(() => {});
    throw error;
  }
}
