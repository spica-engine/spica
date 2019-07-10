import {Component, OnInit} from "@angular/core";
import {ActivatedRoute} from "@angular/router";
import {Observable} from "rxjs";
import {switchMap} from "rxjs/operators";
import {DocService} from "../../services/doc.service";

@Component({
  selector: "app-doc-list",
  templateUrl: "./doc-list.component.html",
  styleUrls: ["./doc-list.component.css"]
})
export class DocListComponent implements OnInit {
  $doc: Observable<any>;

  constructor(private doc: DocService, private router: ActivatedRoute) {}

  ngOnInit() {
    this.$doc = this.router.params.pipe(switchMap(params => this.doc.getApiDocList(params.name)));
  }
}
