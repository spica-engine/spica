import {BreakpointObserver, Breakpoints} from "@angular/cdk/layout";
import {Component, OnInit} from "@angular/core";
import {Observable} from "rxjs";
import {map, startWith} from "rxjs/operators";
import {DocService} from "../../services/doc.service";

@Component({
  selector: "app-docs-layout",
  templateUrl: "./docs-layout.component.html",
  styleUrls: ["./docs-layout.component.scss"]
})
export class DocsLayoutComponent implements OnInit {
  $apiDocs: Observable<any>;
  $contentDocs: Observable<any>;
  isHandset$: Observable<boolean> = this.breakpointObserver
    .observe([Breakpoints.Handset, Breakpoints.Tablet])
    .pipe(
      map(result => result.matches),
      startWith(true)
    );

  constructor(docs: DocService, private breakpointObserver: BreakpointObserver) {
    this.$apiDocs = docs.getApiDocs();
    this.$contentDocs = docs.getContentDocs();
  }

  ngOnInit() {}
}
