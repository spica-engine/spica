import {HttpClientTestingModule, HttpTestingController} from "@angular/common/http/testing";
import {ComponentFixture, TestBed} from "@angular/core/testing";
import {
  MatCardModule,
  MatDialogRef,
  MatGridListModule,
  MatIconModule,
  MatPaginator,
  MatPaginatorModule,
  MatProgressBarModule,
  MatTabsModule
} from "@angular/material";
import {By} from "@angular/platform-browser";
import {NoopAnimationsModule} from "@angular/platform-browser/animations";
import {ngfModule} from "angular-file";
import {Subject} from "rxjs";
import {map} from "rxjs/operators";
import {Storage} from "../../interfaces/storage";
import {StorageService} from "../../storage.service";
import {StorageViewComponent} from "../storage-view/storage-view.component";
import {PickerComponent} from "./picker.component";

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
        ngfModule
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

    it("should handle pageSize changes", () => {
      paginator._changePageSize(15);
      expect(storageService.getAll).toHaveBeenCalledTimes(1);
      expect(storageService.getAll.calls.mostRecent().args[0]).toBe(15);
      expect(storageService.getAll.calls.mostRecent().args[1]).toBe(0);
    });
  });
});
