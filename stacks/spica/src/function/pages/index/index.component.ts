import {Component, OnInit} from "@angular/core";
import {Observable} from "rxjs";
import {FunctionService} from "../../services";
import {Function} from "../../interface";
import {tap} from "rxjs/operators";

@Component({
  selector: "function-index",
  templateUrl: "./index.component.html",
  styleUrls: ["./index.component.scss"]
})
export class IndexComponent implements OnInit {
  public $data: Observable<Function[]>;
  public displayedColumns = ["_id", "name", "description", "group", "actions"];
  categories: string[] = [];
  constructor(private functionService: FunctionService) {}

  ngOnInit() {
    this.$data = this.functionService
      .getFunctions()
      .pipe(
        tap(
          functions =>
            (this.categories = [
              ...new Set(functions.filter(findex => findex.category).map(findex => findex.category))
            ])
        )
      );
  }

  delete(id: string): void {
    this.functionService.delete(id).toPromise();
  }
  update(func: Function) {
    this.functionService.replaceOne(func).toPromise();
  }
}
