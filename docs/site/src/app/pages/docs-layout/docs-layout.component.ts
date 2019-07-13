import {Component, OnInit} from "@angular/core";
import {Observable} from "rxjs";
import {DocService} from "../../services/doc.service";

@Component({
  selector: "app-docs-layout",
  templateUrl: "./docs-layout.component.html",
  styleUrls: ["./docs-layout.component.scss"]
})
export class DocsLayoutComponent implements OnInit {
  $apiDocs: Observable<any>;
  $contentDocs: Observable<any[]>;

  constructor(docs: DocService) {
    this.$apiDocs = docs.getApiDocs();
    this.$contentDocs = docs.getContentDocs();
  }

  ngOnInit() {}
}
