import {Component, OnInit} from "@angular/core";
import {Observable, of} from "rxjs";
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
  public displayedColumns = ["_id", "name", "description", "actions"];

  $delete: Observable<any>[] = [];

  constructor(private functionService: FunctionService) {}

  ngOnInit() {
    this.$data = this.functionService.getFunctions().pipe(
      tap(fs => {
        this.$delete = [];
        fs.forEach(() => this.$delete.push());
      })
    );
  }

  delete(id: string, i: number): void {
    this.$delete[i] = this.functionService.delete(id);
  }
}
