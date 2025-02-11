import {HttpClientTestingModule} from "@angular/common/http/testing";
import {ComponentFixture, TestBed} from "@angular/core/testing";
import {MAT_DIALOG_DATA} from "@angular/material/dialog";
import {MatIconModule} from "@angular/material/icon";
import {StorageViewComponent} from "../storage-view/storage-view.component";
import {StorageDialogOverviewDialog} from "./storage-dialog-overview";
import {Component, Input} from "@angular/core";
import {By} from "@angular/platform-browser";

@Component({
  selector: "storage-view",
  template: ""
})
class StorageViewCmp {
  @Input() blob: string | Blob | Storage;
  @Input() autoplay: boolean;
}

describe("StorageDialogOverview", () => {
  let fixture: ComponentFixture<StorageDialogOverviewDialog>;
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [MatIconModule, HttpClientTestingModule],
      declarations: [StorageDialogOverviewDialog, StorageViewCmp],
      providers: [
        {
          provide: MAT_DIALOG_DATA,
          useValue: "test"
        }
      ]
    });

    fixture = TestBed.createComponent(StorageDialogOverviewDialog);
    fixture.detectChanges();
  });

  it("should pass the MAT_DIALOG_DATA to the component", () => {
    expect(fixture.debugElement.query(By.directive(StorageViewCmp)).componentInstance.blob).toEqual(
      "test"
    );
  });
});
