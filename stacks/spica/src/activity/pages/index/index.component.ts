import {Component, OnInit} from "@angular/core";
import {Actions, Activity} from "../../interface";

@Component({
  selector: "app-index",
  templateUrl: "./index.component.html",
  styleUrls: ["./index.component.scss"]
})
export class IndexComponent implements OnInit {
  activities$: Activity[];

  displayedColumns: string[] = ["user", "action", "module", "documentId", "date"];

  constructor() {}

  ngOnInit() {
    this.activities$ = [
      {
        _id: "1",
        action: Actions.INSERT,
        module: "bucket/some_bucket_id",
        srcId: "some_data_id",
        user: "tuna",
        date: new Date(2020, 3, 15, 12)
      },
      {
        _id: "2",
        action: Actions.DELETE,
        module: "Passport",
        srcId: "some_data_id2",
        user: "ahmet",
        date: new Date(2020, 3, 15, 13)
      }
    ];
  }
}
