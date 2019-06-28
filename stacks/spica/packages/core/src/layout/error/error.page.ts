import {Component, OnInit} from "@angular/core";
import {ActivatedRoute} from "@angular/router";
import {Observable} from "rxjs";

@Component({
  selector: "page-error",
  templateUrl: "error.page.html",
  styleUrls: ["error.page.scss"]
})
export class ErrorPageComponent implements OnInit {
  $error: Observable<any>;

  constructor(public activatedRoute: ActivatedRoute) {}

  ngOnInit() {
    this.$error = this.activatedRoute.queryParams;
  }
}
