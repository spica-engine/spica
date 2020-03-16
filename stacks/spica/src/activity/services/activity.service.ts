import {Activity, Actions, ActivityFilter} from "../interface";
import {of, Observable} from "rxjs";
import {Injectable} from "@angular/core";
import {FilterQuery} from "mongodb";

@Injectable()
export class ActivityService {
  activities: Activity[] = [
    {
      _id: "1",
      action: Actions.INSERT,
      module: "Bucket",
      documentId: "some_data_id",
      user: "tuna",
      date: new Date(2020, 2, 15, 12)
    },
    {
      _id: "2",
      action: Actions.DELETE,
      module: "Identity",
      documentId: "some_data_id2",
      user: "ahmet",
      date: new Date(2020, 2, 15, 13)
    }
  ];

  get(
    filter: ActivityFilter = {
      actions: [],
      date: {
        begin: undefined,
        end: undefined
      },
      modules: []
    }
  ): Observable<Activity[]> {
    let filteredActivities = JSON.parse(JSON.stringify(this.activities));

    if (filter.date.begin && filter.date.end) {
      filteredActivities = this.activities.filter(
        activity => activity.date >= filter.date.begin && activity.date <= filter.date.end
      );
    }

    if (filter.actions.length >= 1) {
      filteredActivities = filteredActivities.filter(activity =>
        filter.actions.includes(activity.action)
      );
    }

    if (filter.modules.length >= 1) {
      filteredActivities = filteredActivities.filter(activity =>
        filter.modules.includes(activity.module)
      );
    }
    return of(filteredActivities as Activity[]);
  }
}
