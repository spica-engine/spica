import {Component, OnInit} from "@angular/core";
import {Observable} from "rxjs";
import {FunctionService} from "../../function.service";
import {Function} from "../../interface";

@Component({
  selector: "function-index",
  templateUrl: "./index.component.html",
  styleUrls: ["./index.component.scss"]
})
export class IndexComponent implements OnInit {
  public $data: Observable<Function[]>;
  public displayedColumns = ["_id", "name", "description", "info", "actions"];

  constructor(private functionService: FunctionService) {}

  ngOnInit() {
    this.$data = this.functionService.getFunctions();
  }

  refresh(): void {
    this.functionService.loadFunctions().toPromise();
  }

  delete(id: string): void {
    this.functionService.delete(id).toPromise();
  }
}
