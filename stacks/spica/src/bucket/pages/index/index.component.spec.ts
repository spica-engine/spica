import {ComponentFixture, fakeAsync, TestBed, tick} from "@angular/core/testing";
import {FormsModule} from "@angular/forms";
import {MatBadgeModule} from "@angular/material/badge";
import {MatButtonModule} from "@angular/material/button";
import {MatCardModule} from "@angular/material/card";
import {MatCheckboxModule} from "@angular/material/checkbox";
import {MatChipsModule} from "@angular/material/chips";
import {MatDividerModule} from "@angular/material/divider";
import {MatExpansionModule} from "@angular/material/expansion";
import {MatIconModule} from "@angular/material/icon";
import {MatMenuModule} from "@angular/material/menu";
import {MatPaginator, MatPaginatorModule} from "@angular/material/paginator";
import {MatProgressSpinnerModule} from "@angular/material/progress-spinner";
import {MatSelectModule} from "@angular/material/select";
import {MatSortModule} from "@angular/material/sort";
import {MatTableModule} from "@angular/material/table";
import {MatToolbarModule} from "@angular/material/toolbar";
import {MatTooltipModule} from "@angular/material/tooltip";
import {By, DomSanitizer} from "@angular/platform-browser";
import {NoopAnimationsModule} from "@angular/platform-browser/animations";
import {ActivatedRoute} from "@angular/router";
import {RouterTestingModule} from "@angular/router/testing";
import {OwlDateTimeModule} from "@danielmoncada/angular-datetime-picker";
import {
  CommonModule as SpicaCommon,
  InputModule,
  PersistHeaderWidthDirective
} from "@spica-client/common";
import {MatAwareDialogModule, MatClipboardModule} from "@spica-client/material";
import {MatResizeHeaderModule} from "@spica-client/material/resize";
import {of, Subject} from "rxjs";
import {map} from "rxjs/operators";
import {CanInteractDirectiveTest} from "@spica-client/passport/directives/can-interact.directive";
import {FilterComponent} from "../../components/filter/filter.component";
import {Bucket} from "../../interfaces/bucket";
import {BucketRow} from "../../interfaces/bucket-entry";
import {BucketDataService} from "../../services/bucket-data.service";
import {BucketService} from "../../services/bucket.service";
import {IndexComponent} from "./index.component";
import {LayoutModule} from "@spica-client/core/layout";

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
    params: new Subject(),
    queryParams: of()
  };

  let getItem: jasmine.Spy;
  let setItem: jasmine.Spy;

  let navigateSpy: jasmine.Spy;

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
        MatResizeHeaderModule,
        MatPaginatorModule,
        MatSelectModule,
        InputModule.withPlacers([]),
        MatAwareDialogModule,
        MatClipboardModule,
        RouterTestingModule,
        MatDividerModule,
        MatExpansionModule,
        FormsModule,
        SpicaCommon,
        OwlDateTimeModule,
        NoopAnimationsModule,
        LayoutModule
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
        },
        {
          provide: DomSanitizer,
          useValue: {
            bypassSecurityTrustHtml: val => val
          }
        }
      ],
      declarations: [
        IndexComponent,
        FilterComponent,
        PersistHeaderWidthDirective,
        CanInteractDirectiveTest
      ]
    }).compileComponents();

    getItem = spyOn(localStorage, "getItem").and.callFake(() => null);
    setItem = spyOn(localStorage, "setItem");

    fixture = TestBed.createComponent(IndexComponent);
    fixture.detectChanges(false);

    bucketDataService.find.calls.reset();
    bucketService.getBucket.calls.reset();
    navigateSpy = spyOn(fixture.componentInstance["router"], "navigate");

    activatedRoute.params.next({id: 1});
    fixture.detectChanges();
  });

  describe("basic behavior", () => {
    it("should render bucket information", () => {
      bucket.next({
        _id: "bucket_id",
        title: "My Bucket",
        description: "My bucket's description.",
        icon: "test",
        primary: "test",
        properties: {
          test: {
            type: "string"
          }
        }
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
      ).toContain("Bucket ID: bucket_id");
      expect(
        fixture.debugElement.query(By.css("mat-toolbar > span > h5")).nativeElement.textContent
      ).toBe(" My bucket's description. ");

      expect(bucketService.getBucket).toHaveBeenCalledTimes(1);
    });

    it("should show readonly badge", () => {
      bucket.next({
        primary: "test",
        readOnly: true,
        properties: {
          test: {
            type: "string"
          }
        }
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
        primary: "test",
        readOnly: true,
        properties: {
          test: {
            type: "string"
          }
        }
      });
      fixture.detectChanges();

      expect(
        fixture.debugElement.query(By.css("mat-toolbar > div.actions >button:first-of-type"))
          .nativeElement.textContent
      ).toContain("refresh");

      expect(bucketService.getBucket).toHaveBeenCalledTimes(1);
    });
  });

  describe("actions", () => {
    beforeEach(() => {
      bucket.next({
        _id: "1",
        primary: "test",
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
          .query(By.css("mat-toolbar > div.actions > button:nth-of-type(5)"))
          .nativeElement.click();
        fixture.detectChanges();
        const options = document.body.querySelectorAll(".mat-menu-content .mat-menu-item");
        expect(options[1].textContent).toBe(" Turkish (tr_TR) ");
        expect(options[0].textContent).toBe(" English (en_US) ");
      });

      it("should change language", () => {
        bucketDataService.find.calls.reset();
        fixture.debugElement
          .query(By.css("mat-toolbar > div.actions > button:nth-of-type(5)"))
          .nativeElement.click();
        fixture.detectChanges();
        document.body.querySelector<HTMLButtonElement>(".mat-menu-content .mat-menu-item").click();

        expect(navigateSpy).toHaveBeenCalledTimes(1);
        expect(navigateSpy).toHaveBeenCalledWith([], {
          queryParams: {
            filter: "{}",
            paginator: JSON.stringify(fixture.componentInstance.defaultPaginatorOptions),
            sort: "{}",
            language: "en_US"
          }
        });
      });
    });

    describe("columns", () => {
      it("should render", () => {
        fixture.debugElement
          .query(By.css("mat-toolbar > div.actions > button:nth-of-type(4)"))
          .nativeElement.click();
        fixture.detectChanges();
        expect(
          Array.from(document.body.querySelectorAll(".mat-menu-content .mat-menu-item")).map(e =>
            e.textContent.trim()
          )
        ).toEqual(["Display all", "Select", "_id", "test", "Scheduled", "Actions"]);
      });

      it("should set displayed properties from local storage", async () => {
        getItem.and.returnValue(JSON.stringify(["test"]));

        bucket.next({
          _id: "1",
          properties: {
            test: {
              title: "test",
              type: "string",
              options: {
                position: "bottom"
              }
            },
            test2: {
              title: "test2",
              type: "string",
              options: {
                position: "bottom"
              }
            }
          }
        });
        fixture.detectChanges();

        expect(fixture.componentInstance.displayedProperties).toEqual(["test"]);
      });

      it("should not render select when readonly", () => {
        bucket.next({
          _id: "1",
          primary: "test",
          readOnly: true,
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
        fixture.debugElement
          .query(By.css("mat-toolbar > div.actions > button:nth-of-type(3)"))
          .nativeElement.click();
        fixture.detectChanges();

        expect(
          Array.from(document.body.querySelectorAll(".mat-menu-content .mat-menu-item")).map(e =>
            e.textContent.trim()
          )
        ).toEqual(["Display all", "_id", "test", "Scheduled", "Actions"]);
      });

      it("should display later checked properties", fakeAsync(() => {
        fixture.componentInstance.displayedProperties = [];

        fixture.debugElement
          .query(By.css("mat-toolbar > div.actions > button:nth-of-type(4)"))
          .nativeElement.click();
        fixture.detectChanges();

        document.body
          .querySelector<HTMLButtonElement>(
            ".mat-menu-content .mat-menu-item:nth-of-type(4) .mat-checkbox-label"
          )
          .click();
        tick(1);
        fixture.detectChanges();

        //resize directive has a setTimeout method inside of ngAfterViewInit
        tick(1);
        fixture.detectChanges();

        expect(fixture.componentInstance.displayedProperties).toContain("test");

        expect(setItem).toHaveBeenCalledTimes(1);
        expect(setItem).toHaveBeenCalledWith("1-displayedProperties", '["test"]');
      }));
    });

    it("should refresh", () => {
      bucketDataService.find.calls.reset();
      fixture.debugElement
        .query(By.css("mat-toolbar > div.actions > button:nth-of-type(2)"))
        .nativeElement.click();
      fixture.detectChanges();
      expect(bucketDataService.find).toHaveBeenCalledTimes(1);
    });

    it("should show scheduled", () => {
      bucketDataService.find.calls.reset();
      fixture.debugElement
        .query(By.css("mat-toolbar > div.actions > button:nth-of-type(6)"))
        .nativeElement.click();
      fixture.detectChanges();
      expect(bucketDataService.find).toHaveBeenCalledTimes(1);
      expect(bucketDataService.find.calls.mostRecent().args[1].schedule).toBe(true);
    });

    it("should show guide button", () => {
      expect(
        fixture.debugElement.query(By.css("mat-toolbar > div.actions >button:nth-of-type(6)"))
          .nativeElement
      ).toBeTruthy();
    });
    it("should show guide panel when clicked guide button", () => {
      fixture.debugElement
        .query(By.css("mat-toolbar > div.actions > button:nth-of-type(7)"))
        .nativeElement.click();
      fixture.detectChanges();
      expect(fixture.debugElement.query(By.css("mat-card.hide"))).toBeNull();
    });
  });

  describe("rows", () => {
    beforeEach(() => {
      rows.next([{_id: "1", test: "123"}]);
      fixture.detectChanges();
      bucket.next({
        _id: "1",
        primary: "test",
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

    it("should render correctly", () => {
      const headerCells = fixture.debugElement.nativeElement.querySelectorAll(
        "table[mat-table] tr[mat-header-row] th[mat-header-cell]"
      );
      const cell = fixture.debugElement.nativeElement.querySelector(
        "table[mat-table] tr[mat-row] td[mat-cell] span:first-of-type"
      );
      expect(headerCells[0].textContent).toBe(" test ");
      expect(headerCells[1].textContent).toBe("Actions");
      expect(cell.textContent).toBe("123");
    });

    it("should render actions correctly", () => {
      const [editButton, deleteButton] = fixture.debugElement.nativeElement.querySelectorAll(
        "table[mat-table] tr[mat-row] td[mat-cell]:last-of-type > button"
      );
      expect(editButton.textContent).toBe("edit");
      expect(deleteButton.textContent).toBe("delete");
    });

    describe("select", () => {
      beforeEach(() => {
        fixture.componentInstance.displayedProperties.unshift("$$spicainternal_select");
        fixture.detectChanges();
      });

      it("should select", fakeAsync(() => {
        fixture.debugElement.nativeElement
          .querySelector(
            "table[mat-table] tr[mat-row] td[mat-cell]:first-of-type mat-checkbox .mat-checkbox-label"
          )
          .click();
        fixture.detectChanges();

        tick();
        fixture.detectChanges();

        expect(fixture.componentInstance.selectedItems).toContain({_id: "1", test: "123"});
        expect(
          fixture.debugElement.nativeElement.querySelector(
            "table[mat-table] tr[mat-header-row] th[mat-header-cell]:first-of-type mat-checkbox"
          ).classList
        ).toContain("mat-checkbox-checked");
        expect(
          fixture.debugElement.nativeElement.querySelector(
            "table[mat-table] tr[mat-row] td[mat-cell]:first-of-type mat-checkbox"
          ).classList
        ).toContain("mat-checkbox-checked");
      }));

      it("should select all", fakeAsync(() => {
        expect(fixture.componentInstance.selectedItems).toEqual([]);

        const selectAllCheckbox = fixture.debugElement.nativeElement.querySelector(
          "table[mat-table] tr[mat-header-row] th[mat-header-cell]:first-of-type mat-checkbox"
        );

        selectAllCheckbox.querySelector(".mat-checkbox-label").click();
        fixture.detectChanges();

        tick();
        fixture.detectChanges();

        expect(
          fixture.debugElement.nativeElement.querySelector(
            "table[mat-table] tr[mat-row] td[mat-cell]:first-of-type mat-checkbox"
          ).classList
        ).toContain("mat-checkbox-checked");
        expect(selectAllCheckbox.classList).toContain("mat-checkbox-checked");
        expect(fixture.componentInstance.selectedItems).toEqual([{_id: "1", test: "123"}]);
      }));

      it("should show delete action", () => {
        fixture.componentInstance.selectedItems.push({_id: "1", test: "123"});
        fixture.detectChanges();
        expect(
          fixture.debugElement.nativeElement.querySelector(
            "mat-toolbar > div.actions > button:first-of-type"
          ).textContent
        ).toContain("delete");
      });
    });
  });

  describe("row template", () => {
    let templateCache;
    const defaultDiv = val => `<div style='display:inline-block;min-width:20px' >${val}</div>`;

    beforeEach(() => {
      templateCache = fixture.componentInstance.templateMap;
      templateCache.clear();
    });

    it("should return defult div when value is undefined or null", () => {
      const template = fixture.componentInstance.buildTemplate(
        undefined,
        {type: "string"},
        "title"
      );
      expect(template).toEqual(defaultDiv(""));
    });

    it("should return object", () => {
      const template = fixture.componentInstance.buildTemplate(
        {test: "value"},
        {type: "object"},
        "object"
      );
      expect(template).toEqual(defaultDiv(JSON.stringify({test: "value"})));
    });

    it("should return date", () => {
      const now = new Date();
      const template = fixture.componentInstance.buildTemplate(
        now,
        {
          type: "date"
        },
        "created_at"
      );
      expect(template).toEqual(defaultDiv(now.toLocaleString()));
    });

    it("should return color", () => {
      const template = fixture.componentInstance.buildTemplate(
        "#ffffff",
        {type: "color"},
        "favorite_color"
      );
      expect(template).toEqual(
        "<div style='display:inline-block;width:20px;height:20px;background-color:#ffffff;border-radius:3px' ></div>"
      );
    });

    it("should return relation one to one", () => {
      const template = fixture.componentInstance.buildTemplate(
        {test: "test", otherField: "other_value"},
        {
          type: "relation",
          relationType: "onetoone",
          primary: "test"
        },
        "address"
      );
      expect(template).toEqual(defaultDiv("test"));
    });

    it("should return relation one to many", () => {
      const template = fixture.componentInstance.buildTemplate(
        [{test: "val1", otherField: "other_value"}, {test: "val2", otherField: "other_value2"}],
        {
          type: "relation",
          relationType: "onetomany",
          primary: "test"
        },
        "users"
      );
      expect(template).toEqual(defaultDiv(["val1", "val2"]));
    });

    it("should return storage", () => {
      fixture.componentInstance.onImageError = undefined;

      const template = fixture.componentInstance.buildTemplate(
        "test_url",
        {type: "storage"},
        "avatar"
      );
      expect(template).toEqual(
        "<img style='width:100px;height:100px;margin:10px;border-radius:3px' src=test_url alt=test_url onerror=undefined>"
      );
    });

    it("should change color of not supported image", () => {
      fixture.componentInstance.refreshOnImageErrorStyle(true);

      let invert = "invert(100%)";

      expect(fixture.componentInstance.onImageError).toEqual(
        `this.src='assets/image_not_supported.svg';this.style.width='30px';this.style.height='30px';this.style.marginLeft='45px';this.style.marginRight='45px';this.style.marginTop='10px';this.style.marginBottom='10px';this.style.filter='${invert}';`
      );

      fixture.componentInstance.refreshOnImageErrorStyle(false);

      invert = "invert(0%)";

      expect(fixture.componentInstance.onImageError).toEqual(
        `this.src='assets/image_not_supported.svg';this.style.width='30px';this.style.height='30px';this.style.marginLeft='45px';this.style.marginRight='45px';this.style.marginTop='10px';this.style.marginBottom='10px';this.style.filter='${invert}';`
      );
    });

    it("should use existing value instead of creating new one", () => {
      const createTemplateSpy = spyOn(
        fixture.componentInstance["sanitizer"],
        "bypassSecurityTrustHtml"
      ).and.callThrough();

      const template = fixture.componentInstance.buildTemplate(
        "test_url",
        {type: "storage"},
        "avatar"
      );

      expect(templateCache.get(`avatar_test_url`)).toEqual(template);

      expect(createTemplateSpy).toHaveBeenCalledTimes(1);

      const sameTemplate = fixture.componentInstance.buildTemplate(
        "test_url",
        {type: "storage"},
        "avatar"
      );

      expect(sameTemplate).toEqual(template);

      // it should not be two if it uses the cache
      expect(createTemplateSpy).toHaveBeenCalledTimes(1);
    });

    it("should create new template for new values", () => {
      const createTemplateSpy = spyOn(
        fixture.componentInstance["sanitizer"],
        "bypassSecurityTrustHtml"
      ).and.callThrough();

      const template = fixture.componentInstance.buildTemplate(
        "test_url",
        {type: "storage"},
        "avatar"
      );

      expect(templateCache.get(`avatar_test_url`)).toEqual(template);

      expect(createTemplateSpy).toHaveBeenCalledTimes(1);

      const differentTemplate = fixture.componentInstance.buildTemplate(
        "test_url2",
        {type: "storage"},
        "avatar"
      );

      expect(differentTemplate).not.toEqual(template);

      expect(templateCache.get(`avatar_test_url2`)).toEqual(differentTemplate);

      // it should be 2 if it does not use cache
      expect(createTemplateSpy).toHaveBeenCalledTimes(2);
    });

    it("should create new template for arrays", () => {
      const template = fixture.componentInstance.buildTemplate(["test"], {type: "array"}, "items");

      expect(templateCache.get(`items_["test"]`)).toEqual(template);

      const differentTemplate = fixture.componentInstance.buildTemplate(
        ["test2"],
        {type: "array"},
        "items"
      );

      expect(differentTemplate).not.toEqual(template);

      expect(templateCache.get(`items_["test2"]`)).toEqual(differentTemplate);
    });

    it("should create new template for objects", () => {
      const template = fixture.componentInstance.buildTemplate(
        {field1: "test"},
        {type: "object"},
        "address"
      );

      expect(templateCache.get(`address_{"field1":"test"}`)).toEqual(template);

      const differentTemplate = fixture.componentInstance.buildTemplate(
        {field1: "test2"},
        {type: "object"},
        "address"
      );

      expect(differentTemplate).not.toEqual(template);

      expect(templateCache.get(`address_{"field1":"test2"}`)).toEqual(differentTemplate);
    });
  });

  describe("readonly", () => {
    beforeEach(() => {
      bucket.next({
        primary: "test",
        readOnly: true,
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
      rows.next([{test: "123"}]);
      fixture.detectChanges();
    });

    it("should disable remove button", () => {
      expect(
        fixture.debugElement.nativeElement.querySelector(
          "table[mat-table] tr[mat-row] td[mat-cell]:last-of-type button:last-of-type"
        ).disabled
      ).toBe(true);
    });

    it("should change icon of edit button", () => {
      fixture.detectChanges();
      expect(
        fixture.debugElement.nativeElement.querySelector(
          "table[mat-table] tr[mat-row] td[mat-cell]:last-of-type button:first-of-type"
        ).textContent
      ).toBe("remove_red_eye");
    });
  });

  describe("sort", () => {
    beforeEach(() => {
      bucket.next({
        _id: "1",
        primary: "test",
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
      bucketDataService.find.calls.reset();
    });

    it("should sort ascending", () => {
      fixture.debugElement.nativeElement
        .querySelector("table[mat-table] th[mat-header-cell]")
        .click();

      expect(navigateSpy).toHaveBeenCalledTimes(1);
      expect(navigateSpy).toHaveBeenCalledWith([], {
        queryParams: {
          filter: "{}",
          paginator: JSON.stringify(fixture.componentInstance.defaultPaginatorOptions),
          sort: JSON.stringify({test: 1}),
          language: undefined
        }
      });
    });

    it("should sort descending", () => {
      const sort = fixture.debugElement.nativeElement.querySelector(
        "table[mat-table] th[mat-header-cell]"
      );
      sort.click();
      sort.click();

      expect(navigateSpy).toHaveBeenCalledTimes(2);
      expect(navigateSpy.calls.mostRecent().args).toEqual([
        [],
        {
          queryParams: {
            filter: "{}",
            paginator: JSON.stringify(fixture.componentInstance.defaultPaginatorOptions),
            sort: JSON.stringify({test: -1}),
            language: undefined
          }
        }
      ]);
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

      expect(navigateSpy).toHaveBeenCalledTimes(1);
      expect(navigateSpy).toHaveBeenCalledWith([], {
        queryParams: {
          paginator: JSON.stringify({previousPageIndex: 0, pageIndex: 1, pageSize: 10, length: 20}),
          filter: "{}",
          sort: "{}",
          language: undefined
        }
      });
    });

    it("should handle pageSize changes", () => {
      paginator._changePageSize(5);

      expect(navigateSpy).toHaveBeenCalledTimes(1);
      expect(navigateSpy).toHaveBeenCalledWith([], {
        queryParams: {
          paginator: JSON.stringify({previousPageIndex: 0, pageIndex: 0, pageSize: 5, length: 20}),
          filter: "{}",
          sort: "{}",
          language: undefined
        }
      });
    });
  });

  describe("queryParams", () => {
    it("should navigate with queryparams which includes old ones when paginator changes", () => {
      fixture.componentInstance.filter = {test: "test"};
      fixture.componentInstance.sort = {test: -1};
      fixture.componentInstance.language = "tr_TR";

      fixture.componentInstance.onPaginatorChange({length: 10, pageIndex: 1, pageSize: 5});
      expect(navigateSpy).toHaveBeenCalledTimes(1);
      expect(navigateSpy).toHaveBeenCalledWith([], {
        queryParams: {
          paginator: JSON.stringify({length: 10, pageIndex: 1, pageSize: 5}),
          filter: JSON.stringify({test: "test"}),
          sort: JSON.stringify({test: -1}),
          language: "tr_TR"
        }
      });
    });

    it("should navigate with queryparams which includes old ones except paginator's when filter changes", () => {
      fixture.componentInstance.paginator.length = 10;
      fixture.componentInstance.paginator.pageSize = 5;
      fixture.componentInstance.paginator.pageIndex = 1;

      fixture.componentInstance.sort = {test: -1};
      fixture.componentInstance.language = "tr_TR";

      fixture.componentInstance.onFilterChange({title: "test"});
      expect(navigateSpy).toHaveBeenCalledTimes(1);
      expect(navigateSpy).toHaveBeenCalledWith([], {
        queryParams: {
          paginator: JSON.stringify(fixture.componentInstance.defaultPaginatorOptions),
          filter: JSON.stringify({title: "test"}),
          sort: JSON.stringify({test: -1}),
          language: "tr_TR"
        }
      });
    });

    it("should navigate with queryparams which includes old ones except paginator's when language changes", () => {
      fixture.componentInstance.filter = {test: "test"};
      fixture.componentInstance.sort = {test: 1};
      fixture.componentInstance.paginator.length = 10;
      fixture.componentInstance.paginator.pageSize = 5;
      fixture.componentInstance.paginator.pageIndex = 1;

      fixture.componentInstance.onLanguageChange("en_US");
      expect(navigateSpy).toHaveBeenCalledTimes(1);
      expect(navigateSpy).toHaveBeenCalledWith([], {
        queryParams: {
          paginator: JSON.stringify(fixture.componentInstance.defaultPaginatorOptions),
          filter: JSON.stringify({test: "test"}),
          sort: JSON.stringify({test: 1}),
          language: "en_US"
        }
      });
    });

    it("should navigate with queryparams which includes old ones when sort changes", () => {
      fixture.componentInstance.filter = {test: "test"};
      fixture.componentInstance.paginator.pageSize = 10;
      fixture.componentInstance.paginator.pageIndex = 1;
      fixture.componentInstance.paginator.length = 20;
      fixture.componentInstance.language = "tr_TR";

      fixture.componentInstance.onSortChange({active: "title", direction: "asc"});
      expect(navigateSpy).toHaveBeenCalledTimes(1);
      expect(navigateSpy).toHaveBeenCalledWith([], {
        queryParams: {
          filter: JSON.stringify({test: "test"}),
          paginator: JSON.stringify({
            pageSize: 10,
            pageIndex: 1,
            length: 20
          }),
          sort: JSON.stringify({title: 1}),
          language: "tr_TR"
        }
      });
    });
  });
});
