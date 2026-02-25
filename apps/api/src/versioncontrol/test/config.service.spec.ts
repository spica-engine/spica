import {Test, TestingModule} from "@nestjs/testing";
import {DatabaseTestingModule} from "@spica-server/database/testing";
import {VCConfigService} from "@spica-server/versioncontrol/processors/sync";

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

    // Wait briefly for the change stream to propagate
    await new Promise(resolve => setTimeout(resolve, 500));

    const config = await service.getAutoApproveSyncConfig();
    expect(config).toEqual({document: true, representative: true});
  });

  it("should update cached config when config changes", async () => {
    await service.set({
      autoApproveSync: {document: true, representative: false}
    });
    await new Promise(resolve => setTimeout(resolve, 500));

    let config = await service.getAutoApproveSyncConfig();
    expect(config).toEqual({document: true, representative: false});

    await service.set({
      autoApproveSync: {document: false, representative: true}
    });
    await new Promise(resolve => setTimeout(resolve, 500));

    config = await service.getAutoApproveSyncConfig();
    expect(config).toEqual({document: false, representative: true});
  });

  it("should default missing autoApproveSync in stored config", async () => {
    // Manually insert a config without autoApproveSync
    await service.updateOne(
      {module: "versioncontrol"},
      {$set: {module: "versioncontrol", options: {}}},
      {upsert: true}
    );

    await new Promise(resolve => setTimeout(resolve, 500));

    const config = await service.getAutoApproveSyncConfig();
    expect(config).toEqual({document: false, representative: false});
  });
});
