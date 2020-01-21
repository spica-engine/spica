import {BreakpointObserver, Breakpoints} from "@angular/cdk/layout";
import {Component, OnInit, HostListener} from "@angular/core";
import {Observable} from "rxjs";
import {map, startWith} from "rxjs/operators";
import {DocService} from "../../services/doc.service";

@Component({
  selector: "app-docs-layout",
  templateUrl: "./docs-layout.component.html",
  styleUrls: ["./docs-layout.component.scss"]
})
export class DocsLayoutComponent implements OnInit {
  innerWidth:number;

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
  @HostListener("window:resize", ["$event"])
  onResize(event) {
    this.innerWidth = window.innerWidth;
    console.log(this.innerWidth);
  }

  ngOnInit() {
    this.innerWidth = window.innerWidth;
  }
}
