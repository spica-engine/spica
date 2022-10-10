import {Component, OnInit} from "@angular/core";
import {Observable} from "rxjs";
import {tap} from "rxjs/operators";

import {FunctionService} from "../../services";
import {Function} from "../../interface";
import {RouteCategory} from "@spica-client/core/route";

@Component({
  selector: "function-index",
  templateUrl: "./index.component.html",
  styleUrls: ["./index.component.scss"]
})
export class IndexComponent implements OnInit {
  public $data: Observable<Function[]>;
  functions: Function[];
  categoryStorageKey: string = RouteCategory.Developer;

  public displayedColumns = ["_id", "name", "description", "actions"];

  constructor(private functionService: FunctionService) {}

  ngOnInit() {
    this.$data = this.functionService.getFunctions().pipe(tap(data => (this.functions = data)));
  }

  delete(id: string): void {
    this.functionService.delete(id).toPromise();
  }

  updateIndexes(event) {
    event.forEach(e => this.functionService.updateOne(e.entry_id, e.changes).toPromise());
  }
}
