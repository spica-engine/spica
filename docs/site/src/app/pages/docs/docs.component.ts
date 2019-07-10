import {Component, OnInit} from "@angular/core";
import {HttpClient} from "@angular/common/http";
import {Observable} from "rxjs";
import {DocService} from "../../services/doc.service";

@Component({
  selector: "app-doc",
  templateUrl: "./docs.component.html",
  styleUrls: ["./docs.component.css"]
})
export class DocsComponent implements OnInit {
  $apiDocs: Observable<any>;

  constructor(private docs: DocService) {
    this.$apiDocs = docs.getApiDocs();
  }

  ngOnInit() {}
}
