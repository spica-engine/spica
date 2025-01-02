import {HttpClientTestingModule} from "@angular/common/http/testing";
import {ANALYZE_FOR_ENTRY_COMPONENTS, Component} from "@angular/core";
import {ComponentFixture, TestBed} from "@angular/core/testing";
import {FormsModule} from "@angular/forms";
import {MatCardModule} from "@angular/material/card";
import {MatDialogModule} from "@angular/material/dialog";
import {MatGridListModule} from "@angular/material/grid-list";
import {MatIconModule} from "@angular/material/icon";
import {MatMenuModule} from "@angular/material/menu";
import {MatPaginatorModule} from "@angular/material/paginator";
import {MatLegacyProgressBarModule as MatProgressBarModule} from "@angular/material/legacy-progress-bar";
import {MatLegacyTabsModule as MatTabsModule} from "@angular/material/legacy-tabs";
import {By} from "@angular/platform-browser";
import {NoopAnimationsModule} from "@angular/platform-browser/animations";
import {Subject} from "rxjs";
import {map} from "rxjs/operators";
import {Storage} from "../../interfaces/storage";
import {StorageService} from "../../services/storage.service";
import {StorageViewComponent} from "../storage-view/storage-view.component";
import {PickerComponent} from "./picker.component";
import {PickerDirective} from "./picker.directive";

@Component({
  template: `
    <button storagePicker ngModel (ngModelChange)="change($event)"></button>
  `
})
class TestCmp {
  change = jasmine.createSpy("ngModelChange");
}

describe("StoragePicker", () => {
  let fixture: ComponentFixture<TestCmp>;
  let picker: PickerDirective;

  let objects = new Subject<Storage[]>();

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [
        FormsModule,
        HttpClientTestingModule,
        MatDialogModule,
        MatIconModule,
        MatCardModule,
        MatTabsModule,
        MatGridListModule,
        MatPaginatorModule,
        MatProgressBarModule,
        NoopAnimationsModule,
        MatMenuModule
      ],
      declarations: [TestCmp, PickerDirective, PickerComponent, StorageViewComponent],
      providers: [
        {
          provide: ANALYZE_FOR_ENTRY_COMPONENTS,
          multi: true,
          useValue: PickerComponent
        }
      ]
    });

    TestBed.overrideProvider(StorageService, {
      useValue: {
        getAll: jasmine
          .createSpy("getAll")
          .and.returnValue(objects.pipe(map(r => ({data: r, meta: {total: r.length}}))))
      }
    });

    fixture = TestBed.createComponent(TestCmp);
    fixture.detectChanges();
    picker = fixture.debugElement
      .query(By.directive(PickerDirective))
      .injector.get(PickerDirective);
  });

  it("should open dialog", () => {
    picker.open();
    fixture.detectChanges();
    expect(document.body.querySelector("storage-picker")).toBeTruthy();
  });

  it("should pick from dialog and close", async done => {
    picker.open();
    fixture.detectChanges();

    await new Promise(resolve => setTimeout(resolve, 200));

    const sobj: Storage = {
      name: "test",
      content: {
        type: "image/png"
      },
      url: "http://example/test.png"
    };
    objects.next([sobj]);
    fixture.detectChanges();

    document.body.querySelector<HTMLElement>("storage-view").click();

    setTimeout(() => {
      expect(fixture.componentInstance.change).toHaveBeenCalledTimes(1);
      expect(fixture.componentInstance.change).toHaveBeenCalledWith(sobj);
      expect(document.body.querySelector("storage-picker")).not.toBeTruthy();
      done();
    }, 1);
  });
});
