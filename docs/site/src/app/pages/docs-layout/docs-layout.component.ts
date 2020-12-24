import {BreakpointObserver, Breakpoints} from "@angular/cdk/layout";
import {Component, ElementRef, OnInit, ViewChild} from "@angular/core";
import {NavigationEnd, Router} from "@angular/router";
import {Observable} from "rxjs";
import {filter, map, startWith, tap} from "rxjs/operators";
import {DocService} from "../../services/doc.service";

@Component({
  selector: "app-docs-layout",
  templateUrl: "./docs-layout.component.html",
  styleUrls: ["./docs-layout.component.scss"]
})
export class DocsLayoutComponent implements OnInit {
  $apiDocs: Observable<any>;
  $contentDocs: Observable<any>;
  headingsInContent: {title: string; fragment: string}[];
  activeDocument: string;
  isHandset$: Observable<boolean> = this.breakpointObserver
    .observe([Breakpoints.Handset, Breakpoints.Tablet])
    .pipe(
      map(result => result.matches),
      startWith(true)
    );

  constructor(
    docs: DocService,
    private breakpointObserver: BreakpointObserver,
    private route: Router
  ) {
    this.$apiDocs = docs.getApiDocs();
    this.$contentDocs = docs.getContentDocs();

    docs.documentChanged.subscribe(data => {
      this.headingsInContent = [];
      for (let [i, heading] of data.entries()) {
        this.headingsInContent[i] = {
          title: heading,
          fragment: heading.toLowerCase().replace(/ /g, "-")
        };
      }
      let url = this.route.url;
      this.activeDocument = url.split("/")[url.split("/").length - 1];
    });
  }

  ngOnInit() {}
}
