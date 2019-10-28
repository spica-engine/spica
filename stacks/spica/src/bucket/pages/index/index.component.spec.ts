import {ComponentFixture, fakeAsync, TestBed, tick} from "@angular/core/testing";
import {FormsModule} from "@angular/forms";
import {
  MatBadgeModule,
  MatButtonModule,
  MatCardModule,
  MatCheckboxModule,
  MatChipsModule,
  MatDividerModule,
  MatIconModule,
  MatMenuModule,
  MatPaginatorModule,
  MatProgressSpinnerModule,
  MatSelectModule,
  MatTableModule,
  MatToolbarModule,
  MatTooltipModule
} from "@angular/material";
import {By} from "@angular/platform-browser";
import {NoopAnimationsModule} from "@angular/platform-browser/animations";
import {ActivatedRoute} from "@angular/router";
import {RouterTestingModule} from "@angular/router/testing";
import {InputModule} from "@spica-client/common";
import {MatAwareDialogModule, MatClipboardModule} from "@spica-client/material";
import {of, Subject} from "rxjs";
import {map} from "rxjs/operators";
import {FilterComponent} from "../../components/filter/filter.component";
import {Bucket} from "../../interfaces/bucket";
import {BucketRow} from "../../interfaces/bucket-entry";
import {BucketDataService} from "../../services/bucket-data.service";
import {BucketService} from "../../services/bucket.service";
import {IndexComponent} from "./index.component";

fdescribe("IndexComponent", () => {
  let fixture: ComponentFixture<IndexComponent>;
  let bucket = new Subject<Partial<Bucket>>();
  let rows = new Subject<BucketRow[]>();
  let bucketDataService = {
    find: jasmine
      .createSpy("find")
      .and.returnValue(rows.pipe(map(r => ({meta: {total: r.length}, data: r}))))
  };
  let bucketService = {
    getBucket: jasmine.createSpy("getBucket").and.returnValue(bucket),
    getPreferences: jasmine.createSpy("getPreferences").and.returnValue(
      of({
        language: {
          supported_languages: [{code: "tr_TR", name: "Turkish"}, {code: "en_US", name: "English"}],
          default: {code: "en_US", name: "English"}
        }
      })
    )
  };
  let activatedRoute = {
    params: new Subject()
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [
        MatIconModule,
        MatChipsModule,
        MatMenuModule,
        MatCardModule,
        MatToolbarModule,
        MatCheckboxModule,
        MatBadgeModule,
        MatTooltipModule,
        MatProgressSpinnerModule,
        MatButtonModule,
        MatTableModule,
        MatPaginatorModule,
        MatSelectModule,
        InputModule.withPlacers([]),
        MatAwareDialogModule,
        MatClipboardModule,
        RouterTestingModule,
        MatDividerModule,
        FormsModule,
        NoopAnimationsModule
      ],
      providers: [
        {
          provide: BucketService,
          useValue: bucketService
        },
        {
          provide: BucketDataService,
          useValue: bucketDataService
        },
        {
          provide: ActivatedRoute,
          useValue: activatedRoute
        }
      ],
      declarations: [IndexComponent, FilterComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(IndexComponent);
    fixture.detectChanges();

    bucketDataService.find.calls.reset();
    bucketService.getBucket.calls.reset();

    activatedRoute.params.next({id: 1});
    fixture.detectChanges();
  });

  describe("basic behavior", () => {
    beforeEach(() => {
      bucket.next({
        properties: {
          test: {
            type: "string",
            options: {
              position: "bottom",
              visible: true
            }
          }
        }
      });
      fixture.detectChanges();
    });

    it("should render bucket information", () => {
      bucket.next({
        title: "My Bucket",
        description: "My buckets description.",
        icon: "test",
        properties: {}
      });
      fixture.detectChanges();
      expect(
        fixture.debugElement.query(By.css("mat-toolbar > span > h4 > mat-icon")).nativeElement
          .textContent
      ).toBe("test");
      expect(
        fixture.debugElement.query(By.css("mat-toolbar > span > h4 > span")).nativeElement
          .textContent
      ).toBe("My Bucket");
      expect(
        fixture.debugElement.query(By.css("mat-toolbar > span > h6")).nativeElement.textContent
      ).toBe("My buckets description.");

      expect(bucketService.getBucket).toHaveBeenCalledTimes(1);
    });

    it("should show readonly badge", () => {
      bucket.next({
        readOnly: true,
        properties: {}
      });
      fixture.detectChanges();
      expect(
        fixture.debugElement.query(By.css("mat-toolbar > span > h4 > mat-chip-list mat-chip"))
          .nativeElement.textContent
      ).toBe("Read Only");

      expect(bucketService.getBucket).toHaveBeenCalledTimes(1);
    });

    it("should remove add button when readonly", () => {
      bucket.next({
        readOnly: true,
        properties: {}
      });
      fixture.detectChanges();

      // The last button is the refresh button when we remove add button
      expect(
        fixture.debugElement.query(By.css("mat-toolbar > button:last-of-type")).nativeElement
          .textContent
      ).toBe("refresh");

      expect(bucketService.getBucket).toHaveBeenCalledTimes(1);
    });

    it("should refresh", fakeAsync(() => {
      bucketDataService.find.calls.reset();
      fixture.debugElement
        .query(By.css("mat-toolbar > button:nth-of-type(5)"))
        .nativeElement.click();
      rows.next([{_id: "1", test: "val"}]);
      fixture.detectChanges();
      tick(201);
      expect(bucketDataService.find).toHaveBeenCalledTimes(1);
    }));
  });
});
