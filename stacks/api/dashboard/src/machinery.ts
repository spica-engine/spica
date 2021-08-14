import {ObjectId} from "@spica-server/database";
import {register} from "@spica-server/machinery";
import {store} from "@spica-server/machinery/src/store";
import {Dashboard} from "./dashboard";
import {DashboardService} from "./dashboard.service";

interface DashboardObject {
  _id: string;
  metadata: {
    name: string;
    creationTimestamp?: string;
    uid?: string;
  };
  spec: Dashboard;
}

function v1_dashboard_to_internal(object: DashboardObject) {
  const {spec} = object;

  return <Dashboard>{
    name: spec.name,
    components: spec.components,
    icon: spec.icon || "leaderboard"
  };
}

export function registerInformers(dashboardService: DashboardService) {
  register(
    {
      group: "dashboard",
      resource: "dashboards",
      version: "v1"
    },
    {
      add: async (object: DashboardObject) => {
        const document = v1_dashboard_to_internal(object);
        const dashboard = await dashboardService.insertOne(document);

        const dashboardStore = store<DashboardObject>({
          group: "dashboard",
          resource: "dashboards"
        });

        await dashboardStore.patch(object.metadata.name, {
          metadata: {uid: String(dashboard._id)},
          status: "Ready"
        });
      },
      update: async (oldObject: DashboardObject, newObject: DashboardObject) => {
        const document = v1_dashboard_to_internal(newObject);

        await dashboardService.updateOne(
          {
            _id: new ObjectId(newObject.metadata.uid)
          },
          {$set: document},
          {upsert: true}
        );
      },
      delete: async (object: DashboardObject) => {
        await dashboardService.deleteOne({
          _id: new ObjectId(object.metadata.uid)
        });
      }
    }
  );
}
