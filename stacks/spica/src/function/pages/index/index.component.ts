import {Component, OnInit} from "@angular/core";
import {Observable} from "rxjs";
import {FunctionService} from "../../services";
import {Function} from "../../interface";

@Component({
  selector: "function-index",
  templateUrl: "./index.component.html",
  styleUrls: ["./index.component.scss"]
})
export class IndexComponent implements OnInit {
  public $data: Observable<Function[]>;
  public displayedColumns = ["_id", "name", "description", "actions"];

  constructor(private functionService: FunctionService) {}

  async ngOnInit() {
    this.$data = this.functionService.getFunctions();
  }

  delete(id: string): void {
    this.functionService.delete(id).toPromise();
  }
}
