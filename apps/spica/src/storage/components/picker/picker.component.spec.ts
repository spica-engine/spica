import {HttpClientTestingModule, HttpTestingController} from "@angular/common/http/testing";
import {ComponentFixture, TestBed} from "@angular/core/testing";
import {MatCardModule} from "@angular/material/card";
import {MatLegacyDialogRef as MatDialogRef} from "@angular/material/legacy-dialog";
import {MatGridListModule} from "@angular/material/grid-list";
import {MatIconModule} from "@angular/material/icon";
import {MatPaginator, MatPaginatorModule} from "@angular/material/paginator";
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
import {MatLegacyMenuModule as MatMenuModule} from "@angular/material/legacy-menu";

describe("StorageComponent", () => {
  let fixture: ComponentFixture<PickerComponent>;
  let diaglogRef: jasmine.SpyObj<Partial<MatDialogRef<PickerComponent>>>;
  let storageService: jasmine.SpyObj<Partial<StorageService>>;
  let objects = new Subject<Storage[]>();

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [
        HttpClientTestingModule,
        MatIconModule,
        MatCardModule,
        MatTabsModule,
        MatGridListModule,
        MatPaginatorModule,
        MatProgressBarModule,
        NoopAnimationsModule,
        MatMenuModule
      ],
      declarations: [PickerComponent, StorageViewComponent],
      providers: [
        {
          provide: MatDialogRef,
          useFactory: () => (diaglogRef = {close: jasmine.createSpy("close")})
        }
      ]
    });
    TestBed.overrideProvider(StorageService, {
      useFactory: () =>
        (storageService = {
          getAll: jasmine
            .createSpy("getAll")
            .and.returnValue(objects.pipe(map(r => ({data: r, meta: {total: r.length}}))))
        })
    });
    fixture = TestBed.createComponent(PickerComponent);
    fixture.detectChanges();
  });

  describe("items", () => {
    it("should render items", () => {
      objects.next([
        {
          name: "test",
          content: {
            type: "image/png"
          },
          url: "http://example/test.png"
        }
      ]);
      fixture.detectChanges();
      expect(fixture.debugElement.queryAll(By.directive(StorageViewComponent)).length).toBe(1);
      expect(storageService.getAll).toHaveBeenCalledTimes(1);
    });

    it("should show empty storage label", () => {
      expect(fixture.debugElement.query(By.css("h1")).nativeElement.textContent).toBe(
        "Storage is empty"
      );
    });

    it("should select clicked item", () => {
      const sobj: Storage = {
        name: "test",
        content: {
          type: "image/png"
        },
        url: "http://example/test.png"
      };
      objects.next([sobj]);
      fixture.detectChanges();

      fixture.debugElement.query(By.directive(StorageViewComponent)).nativeElement.click();

      expect(diaglogRef.close).toHaveBeenCalledTimes(1);
      expect(diaglogRef.close).toHaveBeenCalledWith(sobj);
    });
  });

  describe("pagination", () => {
    let paginator: MatPaginator;

    beforeEach(() => {
      storageService.getAll.calls.reset();
      objects.next(
        new Array(20).fill({
          name: "test",
          content: {
            type: "image/png"
          },
          url: "http://example/test.png"
        })
      );
      fixture.detectChanges();
      paginator = fixture.debugElement.query(By.directive(MatPaginator)).injector.get(MatPaginator);
    });

    it("should assign total count", () => {
      expect(paginator.length).toBe(20);
    });

    it("should change page", () => {
      paginator.nextPage();
      expect(storageService.getAll).toHaveBeenCalledTimes(1);
    });
  });
});
