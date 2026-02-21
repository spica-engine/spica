import {Test, TestingModule} from "@nestjs/testing";
import {DashboardService} from "../../src/dashboard.service";
import {DatabaseTestingModule, ObjectId} from "@spica-server/database/testing";
import {getSupplier, getApplier} from "../../src/synchronizer/schema";
import {
  ChangeInitiator,
  ChangeLog,
  ChangeOrigin,
  ChangeType,
  SyncStatuses
} from "@spica-server/interface/versioncontrol";
import YAML from "yaml";
import {Dashboard} from "@spica-server/interface/dashboard";
import {firstValueFrom} from "rxjs";

describe("Dashboard Synchronizer", () => {
  let module: TestingModule;
  let ds: DashboardService;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [DatabaseTestingModule.replicaSet()],
      providers: [DashboardService]
    }).compile();

    ds = module.get(DashboardService);
  });

  afterEach(async () => {
    await module.close();
  });

  describe("dashboardSupplier", () => {
    let dashboardSupplier;

    beforeEach(() => {
      dashboardSupplier = getSupplier(ds);
    });

    it("should return Change Supplier with correct metadata", () => {
      expect(dashboardSupplier).toEqual({
        module: "dashboard",
        subModule: "schema",
        listen: expect.any(Function)
      });
    });

    it("should emit ChangeLog on dashboard first sync", async () => {
      const mockDashboard: Dashboard = {
        _id: new ObjectId(),
        name: "Test Dashboard",
        icon: "test-icon",
        components: []
      };

      await ds.insertOne(mockDashboard);

      const changeLog = await firstValueFrom(dashboardSupplier.listen());

      expect(changeLog).toEqual({
        module: "dashboard",
        sub_module: "schema",
        type: ChangeType.CREATE,
        origin: ChangeOrigin.DOCUMENT,
        resource_id: mockDashboard._id.toString(),
        resource_slug: "Test Dashboard",
        resource_extension: "yaml",
        resource_content: YAML.stringify(mockDashboard),
        created_at: expect.any(Date),
        initiator: ChangeInitiator.INTERNAL
      });
    });

    it("should emit ChangeLog on dashboard insert", done => {
      const mockDashboard: Dashboard = {
        _id: new ObjectId(),
        name: "New Dashboard",
        icon: "new-icon",
        components: []
      };

      const observable = dashboardSupplier.listen();

      observable.subscribe(changeLog => {
        expect(changeLog).toEqual({
          module: "dashboard",
          sub_module: "schema",
          type: ChangeType.CREATE,
          origin: ChangeOrigin.DOCUMENT,
          resource_id: mockDashboard._id.toString(),
          resource_slug: "New Dashboard",
          resource_extension: "yaml",
          resource_content: YAML.stringify(mockDashboard),
          created_at: expect.any(Date),
          initiator: ChangeInitiator.EXTERNAL
        });

        done();
      });

      ds.insertOne(mockDashboard).catch(done.fail);
    });

    it("should emit ChangeLog on dashboard update", done => {
      const dashboardId = new ObjectId();
      const initialDashboard: Dashboard = {
        _id: dashboardId,
        name: "Old Dashboard",
        icon: "old-icon",
        components: []
      };

      const updatedDashboard: Dashboard = {
        _id: dashboardId,
        name: "Updated Dashboard",
        icon: "updated-icon",
        components: []
      };

      const observable = dashboardSupplier.listen();

      observable.subscribe(changeLog => {
        if (changeLog.type === ChangeType.UPDATE) {
          expect(changeLog).toEqual({
            module: "dashboard",
            sub_module: "schema",
            type: ChangeType.UPDATE,
            origin: ChangeOrigin.DOCUMENT,
            resource_id: dashboardId.toString(),
            resource_slug: "Updated Dashboard",
            resource_extension: "yaml",
            resource_content: YAML.stringify(updatedDashboard),
            created_at: expect.any(Date),
            initiator: ChangeInitiator.EXTERNAL
          });
          done();
        }
      });

      ds.insertOne(initialDashboard)
        .then(() => ds.replaceOne({_id: dashboardId}, updatedDashboard))
        .catch(done.fail);
    });

    it("should emit ChangeLog on dashboard delete", done => {
      const dashboardId = new ObjectId();
      const dashboardToDelete: Dashboard = {
        _id: dashboardId,
        name: "Temp Dashboard",
        icon: "temp-icon",
        components: []
      };

      const observable = dashboardSupplier.listen();

      observable.subscribe(changeLog => {
        if (changeLog.type === ChangeType.DELETE) {
          expect(changeLog).toEqual({
            module: "dashboard",
            sub_module: "schema",
            type: ChangeType.DELETE,
            origin: ChangeOrigin.DOCUMENT,
            resource_id: dashboardId.toString(),
            resource_content: YAML.stringify(dashboardToDelete),
            resource_extension: "yaml",
            resource_slug: "Temp Dashboard",
            created_at: expect.any(Date),
            initiator: ChangeInitiator.EXTERNAL
          });
          done();
        }
      });

      ds.insertOne(dashboardToDelete)
        .then(() => ds.deleteOne({_id: dashboardId}))
        .catch(done.fail);
    });
  });

  describe("dashboardApplier", () => {
    let dashboardApplier;

    beforeEach(() => {
      dashboardApplier = getApplier(ds);
    });

    it("should return Change Applier with correct metadata", () => {
      expect(dashboardApplier).toEqual({
        module: "dashboard",
        subModule: "schema",
        fileExtensions: ["yaml"],
        findIdBySlug: expect.any(Function),
        findIdByContent: expect.any(Function),
        apply: expect.any(Function)
      });
    });

    it("should apply insert change successfully", async () => {
      const _id = new ObjectId();
      const mockDashboard: Dashboard = {
        _id,
        name: "New Dashboard",
        icon: "new-icon",
        components: []
      };

      const changeLog: ChangeLog = {
        module: "dashboard",
        sub_module: "schema",
        type: ChangeType.CREATE,
        origin: ChangeOrigin.REPRESENTATIVE,
        resource_id: _id.toString(),
        resource_slug: "New Dashboard",
        resource_content: YAML.stringify(mockDashboard),
        created_at: new Date(),
        resource_extension: "yaml",
        initiator: ChangeInitiator.EXTERNAL
      };

      const result = await dashboardApplier.apply(changeLog);

      expect(result).toEqual({
        status: SyncStatuses.SUCCEEDED
      });

      const insertedDashboard = await ds.findOne({_id});
      expect(insertedDashboard).toEqual({
        _id,
        name: "New Dashboard",
        icon: "new-icon",
        components: []
      });
    });

    it("should apply update change successfully", async () => {
      const _id = new ObjectId();
      const existingDashboard: Dashboard = {
        _id,
        name: "Old Dashboard",
        icon: "old-icon",
        components: []
      };

      await ds.insertOne(existingDashboard);

      const updatedDashboard: Dashboard = {
        _id,
        name: "Updated Dashboard",
        icon: "updated-icon",
        components: []
      };

      const changeLog: ChangeLog = {
        module: "dashboard",
        sub_module: "schema",
        type: ChangeType.UPDATE,
        origin: ChangeOrigin.REPRESENTATIVE,
        resource_id: _id.toString(),
        resource_slug: "Updated Dashboard",
        resource_content: YAML.stringify(updatedDashboard),
        created_at: new Date(),
        resource_extension: "yaml",
        initiator: ChangeInitiator.EXTERNAL
      };

      const result = await dashboardApplier.apply(changeLog);

      expect(result).toEqual({
        status: SyncStatuses.SUCCEEDED
      });

      const dashboard = await ds.findOne({_id});
      expect(dashboard).toEqual({
        _id,
        name: "Updated Dashboard",
        icon: "updated-icon",
        components: []
      });
    });

    it("should apply delete change successfully", async () => {
      const _id = new ObjectId();
      const mockDashboard: Dashboard = {
        _id,
        name: "To Delete",
        icon: "delete-icon",
        components: []
      };

      await ds.insertOne(mockDashboard);

      const changeLog: ChangeLog = {
        module: "dashboard",
        sub_module: "schema",
        type: ChangeType.DELETE,
        origin: ChangeOrigin.REPRESENTATIVE,
        resource_id: _id.toString(),
        resource_slug: null,
        resource_content: "",
        created_at: new Date(),
        resource_extension: "yaml",
        initiator: ChangeInitiator.EXTERNAL
      };

      const result = await dashboardApplier.apply(changeLog);

      expect(result).toEqual({
        status: SyncStatuses.SUCCEEDED
      });

      const dashboard = await ds.findOne({_id});
      expect(dashboard).toBeNull();
    });

    it("should handle unknown operation type", async () => {
      const changeLog: ChangeLog = {
        module: "dashboard",
        sub_module: "schema",
        type: "upsert" as any,
        origin: ChangeOrigin.REPRESENTATIVE,
        resource_id: "123",
        resource_slug: null,
        resource_content: "",
        created_at: new Date(),
        resource_extension: "yaml",
        initiator: ChangeInitiator.EXTERNAL
      };

      const result = await dashboardApplier.apply(changeLog);

      expect(result).toEqual({
        status: SyncStatuses.FAILED,
        reason: "Unknown operation type: upsert"
      });
    });

    it("should handle YAML parse errors", async () => {
      const changeLog: ChangeLog = {
        module: "dashboard",
        sub_module: "schema",
        type: ChangeType.CREATE,
        origin: ChangeOrigin.REPRESENTATIVE,
        resource_id: "123",
        resource_slug: "TEST",
        resource_content: "invalid: yaml: content:",
        created_at: new Date(),
        resource_extension: "yaml",
        initiator: ChangeInitiator.EXTERNAL
      };

      const result = await dashboardApplier.apply(changeLog);

      expect(result).toMatchObject({
        status: SyncStatuses.FAILED
      });
      expect(result.reason).toBeDefined();
    });
  });
});
