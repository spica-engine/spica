import {Test, TestingModule} from "@nestjs/testing";
import {DatabaseTestingModule} from "@spica-server/database-testing";
import {VCConfigService} from "@spica-server/versioncontrol-processors-sync";
import {AutoApproveSyncConfig} from "@spica-server/interface-versioncontrol";

async function waitForAutoApproveSync(
  service: VCConfigService,
  expected: AutoApproveSyncConfig,
  timeoutMs = 5000,
  intervalMs = 100
): Promise<AutoApproveSyncConfig> {
  const start = Date.now();
  let config: AutoApproveSyncConfig;
  while (Date.now() - start < timeoutMs) {
    config = await service.getAutoApproveSyncConfig();
    if (
      config.document === expected.document &&
      config.representative === expected.representative
    ) {
      return config;
    }
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
  return config;
}

describe("VCConfigService", () => {
  let service: VCConfigService;
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [DatabaseTestingModule.replicaSet()],
      providers: [VCConfigService]
    }).compile();

    service = module.get(VCConfigService);
    await module.init();
  });

  afterEach(async () => {
    await module.close();
  });

  it("should return default auto approve config when no config exists", async () => {
    const config = await service.getAutoApproveSyncConfig();
    expect(config).toEqual({document: false, representative: false});
  });

  it("should set and get config", async () => {
    await service.set({
      autoApproveSync: {document: true, representative: false}
    });

    const config = await service.get();
    expect(config.options).toEqual({
      autoApproveSync: {document: true, representative: false}
    });
  });

  it("should return cached auto approve config after set", async () => {
    await service.set({
      autoApproveSync: {document: true, representative: true}
    });

    const config = await waitForAutoApproveSync(service, {document: true, representative: true});
    expect(config).toEqual({document: true, representative: true});
  });

  it("should update cached config when config changes", async () => {
    await service.set({
      autoApproveSync: {document: true, representative: false}
    });

    let config = await waitForAutoApproveSync(service, {document: true, representative: false});
    expect(config).toEqual({document: true, representative: false});

    await service.set({
      autoApproveSync: {document: false, representative: true}
    });

    config = await waitForAutoApproveSync(service, {document: false, representative: true});
    expect(config).toEqual({document: false, representative: true});
  });

  it("should default missing autoApproveSync in stored config", async () => {
    await service.updateOne(
      {module: "versioncontrol"},
      {$set: {module: "versioncontrol", options: {}}},
      {upsert: true}
    );

    const config = await waitForAutoApproveSync(service, {document: false, representative: false});
    expect(config).toEqual({document: false, representative: false});
  });
});
