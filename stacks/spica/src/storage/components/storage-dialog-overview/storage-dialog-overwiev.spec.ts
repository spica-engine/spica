import {HttpClientTestingModule} from "@angular/common/http/testing";
import {ComponentFixture, fakeAsync, TestBed, tick} from "@angular/core/testing";
import {MatDialogRef, MatIconModule, MAT_DIALOG_DATA} from "@angular/material";
import {By} from "@angular/platform-browser";
import {StorageViewComponent} from "../storage-view/storage-view.component";
import {StorageDialogOverviewDialog} from "./storage-dialog-overview";

describe("StorageDialogOverview", () => {
  let fixture: ComponentFixture<StorageDialogOverviewDialog>;
  let observeSpy;
  beforeEach(() => {
    observeSpy = {close: null};
    TestBed.configureTestingModule({
      imports: [MatIconModule, HttpClientTestingModule],
      declarations: [StorageDialogOverviewDialog, StorageViewComponent],
      providers: [
        {
          provide: MatDialogRef,
          useValue: observeSpy
        },
        {
          provide: MAT_DIALOG_DATA,
          useValue: "test"
        }
      ]
    });

    fixture = TestBed.createComponent(StorageDialogOverviewDialog);
    fixture.detectChanges();
  });

  it("Should be seen item, button close working", fakeAsync(() => {
    expect(document.querySelector("storage-view")).toBeTruthy();
    const spy = spyOn(fixture.componentInstance["dialogRef"], "close");
    const button = fixture.debugElement.query(By.css("button"));
    button.nativeElement.click();
    tick();
    fixture.detectChanges();
    expect(spy).toHaveBeenCalledTimes(1);
  }));
});
