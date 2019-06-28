import {Component, Input, OnChanges} from "@angular/core";
import {BehaviorSubject} from "rxjs";
import {Storage} from "../../interfaces/storage";

@Component({
  selector: "storage-view",
  templateUrl: "./storage-view.component.html",
  styleUrls: ["./storage-view.component.scss"]
})
export class StorageViewComponent implements OnChanges {
  @Input() public storage: Storage;
  private storage$ = new BehaviorSubject(this.storage);

  constructor() {}

  ngOnChanges(): void {
    this.storage$.next(this.storage);
  }
}
