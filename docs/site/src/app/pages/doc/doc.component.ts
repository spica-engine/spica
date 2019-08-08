import {Component, OnInit} from "@angular/core";
import {DomSanitizer, SafeHtml} from "@angular/platform-browser";
import {ActivatedRoute} from "@angular/router";
import {Observable} from "rxjs";
import {map, switchMap} from "rxjs/operators";
import {DocService} from "../../services/doc.service";

@Component({
  selector: "app-doc",
  templateUrl: "./doc.component.html",
  styleUrls: ["./doc.component.scss"],
  host: {
    role: "doc article"
  }
})
export class DocComponent implements OnInit {
  $doc: Observable<SafeHtml>;

  constructor(
    private activatedRoute: ActivatedRoute,
    private doc: DocService,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit() {
    this.$doc = this.activatedRoute.params.pipe(
      switchMap(params =>
        params.apiName
          ? this.doc.getApiDoc(params.apiName, params.docName)
          : this.doc.getContentDoc(params.contentName, params.docName || "index")
      ),
      map(text => this.sanitizer.bypassSecurityTrustHtml(text))
    );
  }
}
