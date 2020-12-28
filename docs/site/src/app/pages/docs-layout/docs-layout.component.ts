import {BreakpointObserver, Breakpoints} from "@angular/cdk/layout";
import {Component, OnInit, OnDestroy} from "@angular/core";
import {Router} from "@angular/router";
import {Observable, Subject} from "rxjs";
import {map, startWith, takeUntil} from "rxjs/operators";
import {DocService} from "../../services/doc.service";

@Component({
  selector: "app-docs-layout",
  templateUrl: "./docs-layout.component.html",
  styleUrls: ["./docs-layout.component.scss"]
})
export class DocsLayoutComponent implements OnInit, OnDestroy {
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

  private onDestroy: Subject<void> = new Subject<void>();

  constructor(
    docs: DocService,
    private breakpointObserver: BreakpointObserver,
    private route: Router
  ) {
    this.$apiDocs = docs.getApiDocs();
    this.$contentDocs = docs.getContentDocs();

    docs.documentChanged.pipe(takeUntil(this.onDestroy)).subscribe(data => {
      this.headingsInContent = [];
      for (const [i, heading] of data.entries()) {
        this.headingsInContent[i] = {
          title: heading,
          fragment: heading.toLowerCase().replace(/ /g, "-")
        };
      }
      const url = this.route.url;
      this.activeDocument = url.split("/")[url.split("/").length - 1];
    });
  }

  ngOnInit() {}

  ngOnDestroy() {
    this.onDestroy.next();
  }
}
