import {Component, OnInit} from "@angular/core";
import {MatDialog} from "@angular/material/dialog";
import {AddBucketComponent} from "@spica-client/bucket/components/add-bucket/add-bucket.component";

@Component({
  selector: "app-welcome",
  templateUrl: "./welcome.component.html",
  styleUrls: ["./welcome.component.scss"]
})
export class WelcomeComponent implements OnInit {
  constructor(private dialog: MatDialog) {}

  ngOnInit() {}
  addBucket() {
    this.dialog.open(AddBucketComponent, {
      data: {},
      autoFocus: false
    });
  }
}
