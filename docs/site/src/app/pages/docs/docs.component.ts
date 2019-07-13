import {Component, OnInit} from "@angular/core";
import {Observable} from "rxjs";
import {DocService} from "../../services/doc.service";

@Component({
  selector: "app-doc",
  templateUrl: "./docs.component.html",
  styleUrls: ["./docs.component.scss"]
})
export class DocsComponent implements OnInit {
  $apiDocs: Observable<any>;
  $contentDocs: Observable<any[]>;

  constructor(docs: DocService) {
    this.$apiDocs = docs.getApiDocs();
    this.$contentDocs = docs.getContentDocs();
  }

  ngOnInit() {}
}
