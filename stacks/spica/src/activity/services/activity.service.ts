import {Activity, Actions, ActivityFilter, getAvailableFilters} from "../interface";
import {of, Observable} from "rxjs";
import {Injectable} from "@angular/core";
import {ObjectId} from "bson";

@Injectable()
export class ActivityService {
  activities: Activity[] = [];

  createRandomActivities() {
    let availables = getAvailableFilters();
    let randomActivities: Activity[] = [];
    for (let index = 0; index < 30; index++) {
      randomActivities.push({
        action: Actions[Object.keys(Actions)[Math.floor(Math.random() * Math.floor(3))]],
        date: new Date(
          new Date(2020, 2, 1).getTime() +
            Math.random() * (new Date().getTime() - new Date(2020, 2, 0).getTime())
        ),
        documentId: new ObjectId().toHexString(),
        identifier: this.createIdentifier(),
        module:
          availables.modules[Math.floor(Math.random() * Math.floor(availables.modules.length))]
      });
    }
    return randomActivities;
  }

  createIdentifier() {
    const identifiers = ["Tuna", "Ahmet", "Mehmet", "Ayşe", "Hasan", "Veli", "Necmi"];
    return identifiers[Math.floor(Math.random() * Math.floor(identifiers.length))];
  }

  constructor() {
    this.activities = this.createRandomActivities();
  }

  get(
    filter: ActivityFilter = {
      identifier: undefined,
      actions: [],
      date: {
        begin: undefined,
        end: undefined
      },
      modules: []
    }
  ): Observable<Activity[]> {
    let filteredActivities = JSON.parse(JSON.stringify(this.activities));

    console.log(filter);

    if (filter.identifier) {
      filteredActivities = this.activities.filter(activity =>
        activity.identifier.toLowerCase().includes(filter.identifier.toLowerCase())
      );
    }

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
