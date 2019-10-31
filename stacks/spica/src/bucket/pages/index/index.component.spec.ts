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
  MatPaginator,
  MatPaginatorModule,
  MatProgressSpinnerModule,
  MatSelectModule,
  MatSortModule,
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

describe("IndexComponent", () => {
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
          available: {
            tr_TR: "Turkish",
            en_US: "English"
          },
          default: "tr_TR"
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
        MatSortModule,
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
  });

  describe("actions", () => {
    beforeEach(() => {
      bucket.next({
        _id: "1",
        properties: {
          test: {
            title: "test",
            type: "string",
            options: {
              position: "bottom"
            }
          }
        }
      });
      fixture.detectChanges();
    });

    describe("language", () => {
      it("should render languages", () => {
        fixture.debugElement
          .query(By.css("mat-toolbar > button:nth-of-type(3)"))
          .nativeElement.click();
        fixture.detectChanges();
        const options = document.body.querySelectorAll(".mat-menu-content .mat-menu-item");
        expect(options[1].textContent).toBe(" Turkish (tr_TR) ");
        expect(options[0].textContent).toBe(" English (en_US) ");
      });

      it("should query language", fakeAsync(() => {
        bucketDataService.find.calls.reset();
        fixture.debugElement
          .query(By.css("mat-toolbar > button:nth-of-type(3)"))
          .nativeElement.click();
        fixture.detectChanges();
        document.body.querySelector<HTMLButtonElement>(".mat-menu-content .mat-menu-item").click();
        tick(500);

        expect(fixture.componentInstance.language).toBe("en_US");
        expect(bucketDataService.find).toHaveBeenCalledTimes(1);
        expect(bucketDataService.find.calls.mostRecent().args[1].language).toBe("en_US");
      }));
    });

    describe("columns", () => {
      it("should render", () => {
        fixture.debugElement
          .query(By.css("mat-toolbar > button:nth-of-type(2)"))
          .nativeElement.click();
        fixture.detectChanges();
        expect(
          Array.from(document.body.querySelectorAll(".mat-menu-content .mat-menu-item")).map(e =>
            e.textContent.trim()
          )
        ).toEqual(["Display all", "Select", "test", "Scheduled", "Actions"]);
      });

      it("should not render select when readonly", () => {
        bucket.next({
          _id: "1",
          readOnly: true,
          properties: {
            test: {
              title: "test",
              type: "string",
              options: {
                position: "bottom",
                visible: true
              }
            }
          }
        });
        fixture.detectChanges();
        fixture.debugElement
          .query(By.css("mat-toolbar > button:nth-of-type(2)"))
          .nativeElement.click();
        fixture.detectChanges();

        expect(
          Array.from(document.body.querySelectorAll(".mat-menu-content .mat-menu-item")).map(e =>
            e.textContent.trim()
          )
        ).toEqual(["Display all", "test", "Scheduled", "Actions"]);
      });

      it("should check visible columns by default", fakeAsync(() => {
        bucket.next({
          _id: "1",
          readOnly: true,
          properties: {
            test: {
              title: "test",
              type: "string",
              options: {
                position: "bottom",
                visible: true
              }
            },
            test1: {
              title: "test1",
              type: "string",
              options: {
                position: "bottom"
              }
            }
          }
        });
        fixture.detectChanges();

        fixture.debugElement
          .query(By.css("mat-toolbar > button:nth-of-type(2)"))
          .nativeElement.click();
        fixture.detectChanges();

        tick(1);
        fixture.detectChanges();

        const columns = document.body.querySelectorAll<HTMLInputElement>(
          ".mat-menu-content .mat-menu-item mat-checkbox"
        );
        expect(columns.item(1).classList).toContain("mat-checkbox-checked");
        expect(columns.item(2).classList).not.toContain("mat-checkbox-checked");
      }));

      it("should display later checked properties", fakeAsync(() => {
        fixture.debugElement
          .query(By.css("mat-toolbar > button:nth-of-type(2)"))
          .nativeElement.click();
        fixture.detectChanges();

        document.body
          .querySelector<HTMLButtonElement>(
            ".mat-menu-content .mat-menu-item:nth-of-type(3) .mat-checkbox-label"
          )
          .click();
        tick(1);
        fixture.detectChanges();

        expect(fixture.componentInstance.displayedProperties).toContain("test");
      }));
    });

    it("should refresh", () => {
      bucketDataService.find.calls.reset();
      fixture.debugElement
        .query(By.css("mat-toolbar > button:nth-of-type(5)"))
        .nativeElement.click();
      fixture.detectChanges();
      expect(bucketDataService.find).toHaveBeenCalledTimes(1);
    });

    it("should show scheduled", () => {
      bucketDataService.find.calls.reset();
      fixture.debugElement
        .query(By.css("mat-toolbar > button:nth-of-type(1)"))
        .nativeElement.click();
      fixture.detectChanges();
      expect(bucketDataService.find).toHaveBeenCalledTimes(1);
      expect(bucketDataService.find.calls.mostRecent().args[1].schedule).toBe(true);
    });
  });

  describe("rows", () => {
    beforeEach(() => {
      rows.next([{_id: "1", test: "123"}]);
      fixture.detectChanges();
      bucket.next({
        _id: "1",
        properties: {
          test: {
            title: "test",
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

    it("should render correctly", () => {
      const headerCells = fixture.debugElement.queryAll(
        By.css("mat-table mat-header-row mat-header-cell")
      );
      const cell = fixture.debugElement.query(By.css("mat-table mat-row mat-cell"));
      expect(headerCells[0].nativeElement.textContent).toBe(" test ");
      expect(headerCells[1].nativeElement.textContent).toBe("Actions");
      expect(cell.nativeElement.textContent).toBe(" 123");
    });

    it("should render actions correctly", () => {
      const lastCell = fixture.debugElement.query(
        By.css("mat-table mat-row mat-cell:last-of-type")
      );
      const [editButton, deleteButton] = lastCell.queryAll(By.css("button"));
      expect(editButton.nativeElement.textContent).toBe("edit");
      expect(deleteButton.nativeElement.textContent).toBe("delete");
    });

    describe("select", () => {
      beforeEach(() => {
        fixture.componentInstance.displayedProperties.unshift("$$spicainternal_select");
        fixture.detectChanges();
      });

      it("should select", fakeAsync(() => {
        fixture.debugElement
          .query(
            By.css("mat-table mat-row mat-cell:first-of-type mat-checkbox .mat-checkbox-label")
          )
          .nativeElement.click();
        fixture.detectChanges();

        tick();
        fixture.detectChanges();

        expect(fixture.componentInstance.selectedItems).toContain("1");
        expect(
          fixture.debugElement.query(
            By.css("mat-table mat-header-row mat-header-cell:first-of-type mat-checkbox")
          ).nativeElement.classList
        ).toContain("mat-checkbox-checked");
        expect(
          fixture.debugElement.query(
            By.css("mat-table mat-row mat-cell:first-of-type mat-checkbox")
          ).nativeElement.classList
        ).toContain("mat-checkbox-checked");
      }));

      it("should select all", fakeAsync(() => {
        expect(fixture.componentInstance.selectedItems).toEqual([]);

        const selectAllCheckbox = fixture.debugElement.query(
          By.css("mat-table mat-header-row mat-header-cell:first-of-type mat-checkbox")
        );

        selectAllCheckbox.query(By.css(".mat-checkbox-label")).nativeElement.click();
        fixture.detectChanges();

        tick();
        fixture.detectChanges();

        expect(
          fixture.debugElement.query(
            By.css("mat-table mat-row mat-cell:first-of-type mat-checkbox")
          ).nativeElement.classList
        ).toContain("mat-checkbox-checked");
        expect(selectAllCheckbox.nativeElement.classList).toContain("mat-checkbox-checked");
        expect(fixture.componentInstance.selectedItems).toEqual(["1"]);
      }));

      it("should show delete action", () => {
        fixture.componentInstance.selectedItems.push("1");
        fixture.detectChanges();
        expect(
          fixture.debugElement.query(By.css("mat-toolbar > button:first-of-type")).nativeElement
            .textContent
        ).toBe("delete");
      });
    });
  });

  describe("readonly", () => {
    beforeEach(() => {
      bucket.next({
        readOnly: true,
        properties: {
          test: {
            title: "test",
            type: "string",
            options: {
              position: "bottom",
              visible: true
            }
          }
        }
      });
      rows.next([{test: "123"}]);
      fixture.detectChanges();
    });

    it("should disable remove button", () => {
      expect(
        fixture.debugElement.query(
          By.css("mat-table mat-row mat-cell:last-of-type button:last-of-type")
        ).nativeElement.disabled
      ).toBe(true);
    });

    it("should change icon of edit button", () => {
      fixture.detectChanges();
      expect(
        fixture.debugElement.query(
          By.css("mat-table mat-row mat-cell:last-of-type button:first-of-type")
        ).nativeElement.textContent
      ).toBe("remove_red_eye");
    });
  });

  describe("sort", () => {
    beforeEach(() => {
      bucket.next({
        _id: "1",
        properties: {
          test: {
            title: "test",
            type: "string",
            options: {
              position: "bottom",
              visible: true
            }
          }
        }
      });
      fixture.detectChanges();
      bucketDataService.find.calls.reset();
    });

    it("should sort ascending", () => {
      fixture.debugElement.query(By.css("mat-table mat-header-cell")).nativeElement.click();
      expect(bucketDataService.find).toHaveBeenCalledTimes(1);
      expect(bucketDataService.find.calls.mostRecent().args[1].sort).toEqual({test: 1});
    });

    it("should sort descending", () => {
      const sort = fixture.debugElement.query(By.css("mat-table mat-header-cell")).nativeElement;
      sort.click();
      sort.click();
      expect(bucketDataService.find).toHaveBeenCalledTimes(2);
      expect(bucketDataService.find.calls.mostRecent().args[1].sort).toEqual({test: -1});
    });
  });

  describe("pagination", () => {
    let paginator: MatPaginator;

    beforeEach(() => {
      rows.next(new Array(20).fill({_id: "1", test: "123"}));
      fixture.detectChanges();
      paginator = fixture.debugElement.query(By.directive(MatPaginator)).injector.get(MatPaginator);
      bucketDataService.find.calls.reset();
    });

    it("should assign total count", () => {
      expect(paginator.length).toBe(20);
    });

    it("should change page", () => {
      paginator.nextPage();
      expect(bucketDataService.find).toHaveBeenCalledTimes(1);
      expect(bucketDataService.find.calls.mostRecent().args[1].skip).toBe(10);
      expect(bucketDataService.find.calls.mostRecent().args[1].limit).toBe(10);
    });

    it("should handle pageSize changes", () => {
      paginator._changePageSize(5);
      expect(bucketDataService.find).toHaveBeenCalledTimes(1);
      expect(bucketDataService.find.calls.mostRecent().args[1].skip).toBe(0);
      expect(bucketDataService.find.calls.mostRecent().args[1].limit).toBe(5);
    });
  });
});
