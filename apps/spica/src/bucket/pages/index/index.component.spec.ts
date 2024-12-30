import {ComponentFixture, fakeAsync, TestBed, tick} from "@angular/core/testing";
import {FormsModule, NgModel} from "@angular/forms";
import {MatBadgeModule} from "@angular/material/badge";
import {MatLegacyButtonModule as MatButtonModule} from "@angular/material/legacy-button";
import {MatLegacyCardModule as MatCardModule} from "@angular/material/legacy-card";
import {MatLegacyCheckboxModule as MatCheckboxModule} from "@angular/material/legacy-checkbox";
import {MatChipsModule} from "@angular/material/chips";
import {MatDividerModule} from "@angular/material/divider";
import {MatExpansionModule} from "@angular/material/expansion";
import {MatIconModule} from "@angular/material/icon";
import {MatLegacyMenuModule as MatMenuModule} from "@angular/material/legacy-menu";
import {MatPaginator, MatPaginatorModule} from "@angular/material/paginator";
import {MatLegacyProgressSpinnerModule as MatProgressSpinnerModule} from "@angular/material/legacy-progress-spinner";
import {MatLegacySelectModule as MatSelectModule} from "@angular/material/legacy-select";
import {MatSortModule} from "@angular/material/sort";
import {MatLegacyTableModule as MatTableModule} from "@angular/material/legacy-table";
import {MatToolbarModule} from "@angular/material/toolbar";
import {MatLegacyTooltipModule as MatTooltipModule} from "@angular/material/legacy-tooltip";
import {By} from "@angular/platform-browser";
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
import {Bucket, BUCKET_OPTIONS} from "../../interfaces/bucket";
import {BucketRow} from "../../interfaces/bucket-entry";
import {BucketDataService} from "../../services/bucket-data.service";
import {BucketService} from "../../services/bucket.service";
import {IndexComponent} from "./index.component";
import {LayoutModule} from "@spica-client/core/layout";
import {MatLegacyFormFieldModule as MatFormFieldModule} from "@angular/material/legacy-form-field";
import {MatLegacyInputModule as MatInputModule} from "@angular/material/legacy-input";
import {PropertyMenuComponent} from "../../components/property-menu/property-menu.component";
import {BucketRoutingModule} from "../../bucket-routing.module";
import {StoreModule} from "@ngrx/store";

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
        LayoutModule,
        MatFormFieldModule,
        MatInputModule,
        StoreModule.forRoot({})
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
          provide: BUCKET_OPTIONS,
          useValue: {url: "http://insteadof"}
        }
      ],
      declarations: [
        IndexComponent,
        FilterComponent,
        PersistHeaderWidthDirective,
        CanInteractDirectiveTest,
        PropertyMenuComponent
      ]
    }).compileComponents();

    getItem = spyOn(localStorage, "getItem").and.callFake(() => null);
    setItem = spyOn(localStorage, "setItem");

    fixture = TestBed.createComponent(IndexComponent);
    fixture.componentInstance["sanitizer"].bypassSecurityTrustHtml = v => v;
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
        fixture.debugElement.query(By.css(".actions-line > span > h6")).nativeElement.textContent
      ).toContain("Bucket ID: bucket_id");
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
        fixture.debugElement.query(By.css(".actions-line > span > h6 > mat-chip-list mat-chip"))
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
        fixture.debugElement.query(By.css("div.actions >button:first-of-type")).nativeElement
          .textContent
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
      beforeEach(() => {
        bucket.next({
          _id: "1",
          primary: "test",
          properties: {
            test: {
              title: "test",
              type: "string",
              options: {
                position: "bottom",
                translate: true
              }
            }
          }
        });
        fixture.detectChanges();
      });
      it("should render languages", () => {
        fixture.debugElement
          .query(By.css("div.actions > button:nth-of-type(4)"))
          .nativeElement.click();
        fixture.detectChanges();
        const options = document.body.querySelectorAll(".mat-menu-content .mat-menu-item");
        expect(options[1].textContent).toBe(" Turkish (tr_TR) ");
        expect(options[0].textContent).toBe(" English (en_US) ");
      });

      it("should change language", () => {
        bucketDataService.find.calls.reset();
        fixture.debugElement
          .query(By.css("div.actions > button:nth-of-type(4)"))
          .nativeElement.click();
        fixture.detectChanges();
        const menuItem = document.body.querySelector<HTMLButtonElement>(
          ".mat-menu-content .mat-menu-item"
        );
        menuItem && menuItem.click();

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
          .query(By.css("div.actions > button:nth-of-type(3)"))
          .nativeElement.click();
        fixture.detectChanges();
        expect(
          Array.from(document.body.querySelectorAll(".mat-menu-content .mat-menu-item")).map(
            e => e.textContent && e.textContent.trim()
          )
        ).toEqual(["Display all", "test"]);
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
          .query(By.css("div.actions > button:nth-of-type(2)"))
          .nativeElement.click();
        fixture.detectChanges();

        expect(
          Array.from(document.body.querySelectorAll(".mat-menu-content .mat-menu-item")).map(
            e => e.textContent && e.textContent.trim()
          )
        ).toEqual(["Display all", "test"]);
      });

      it("should display later checked properties", fakeAsync(() => {
        fixture.componentInstance.displayedProperties = [];

        fixture.debugElement
          .query(By.css("div.actions > button:nth-of-type(3)"))
          .nativeElement.click();
        fixture.detectChanges();

        const checkItem = document.body.querySelector<HTMLButtonElement>(
          ".mat-menu-content .mat-menu-item:nth-of-type(2) .mat-checkbox-label"
        );

        checkItem && checkItem.click();
        tick(1);
        fixture.detectChanges();

        //resize directive has a setTimeout method inside of ngAfterViewInit
        tick(1);
        fixture.detectChanges();

        expect(fixture.componentInstance.displayedProperties).toContain("test");

        expect(setItem).toHaveBeenCalledTimes(2);
        expect(setItem).toHaveBeenCalledWith("1-displayedProperties", '["test"]');
      }));
    });

    it("should refresh", () => {
      bucketDataService.find.calls.reset();
      fixture.debugElement
        .query(By.css("div.actions > button:nth-of-type(2)"))
        .nativeElement.click();
      fixture.detectChanges();
      expect(bucketDataService.find).toHaveBeenCalledTimes(1);
    });

    it("should show guide button", () => {
      expect(
        fixture.debugElement.query(By.css("div.actions >button:nth-of-type(4)")).nativeElement
      ).toBeTruthy();
    });

    it("should show guide panel when clicked guide button", () => {
      fixture.debugElement
        .query(By.css("div.actions > button:nth-of-type(5)"))
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
        "table[mat-table] tr[mat-row] td[mat-cell].mat-column-test span"
      );
      expect(headerCells[2].textContent).toBe("format_quote test arrow_drop_down");
      expect(headerCells[3].textContent).toBe("add New field");
      expect(cell.textContent).toBe("123");
    });

    it("should render actions correctly", () => {
      const [editButton, deleteButton] = fixture.debugElement.nativeElement.querySelectorAll(
        "table[mat-table] tr[mat-row] td[mat-cell]:first-of-type > button"
      );
      expect(editButton.textContent).toBe("edit");
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
          fixture.debugElement.nativeElement.querySelector("div.actions > button:first-of-type")
            .textContent
        ).toContain("delete");
      });
    });
  });

  describe("row template", () => {
    let templateCache;
    const defaultDiv = val =>
      `<div style='display:inline-block;width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap' >${val}</div>`;

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
      // &#34; => "
      expect(template).toEqual(defaultDiv("{&#34;test&#34;:&#34;value&#34;}"));
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

      let template = fixture.componentInstance.buildTemplate(
        "test_url",
        {type: "storage"},
        "avatar"
      );

      const timestampRegex = /\?timestamp=([0-9]*)/;
      const timestamp = timestampRegex.exec(template)[1];
      const date = new Date(Number(timestamp));
      expect(isNaN(date.getTime())).toBeFalse();

      template = template.replace(timestampRegex, "");
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

    it("should sanitize input that includes possible malicious code", () => {
      const template = fixture.componentInstance.buildTemplate(
        "<a onmouseover='alert(`some malicious code`)'>click me</a>",
        {type: "string"},
        "title"
      );
      expect(template).toEqual(defaultDiv("<a>click me</a>"));
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

    it("should change icon of edit button", () => {
      fixture.detectChanges();
      expect(
        fixture.debugElement.nativeElement.querySelector(
          "table[mat-table] tr[mat-row] td[mat-cell]:first-of-type button:first-of-type"
        ).textContent
      ).toBe("remove_red_eye");
    });
  });

  describe("filter", () => {
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

    it("should navigate the page after filter input has been filled", fakeAsync(() => {
      const searchArea = fixture.debugElement
        .query(By.css("div.filters > mat-form-field input"))
        .injector.get(NgModel);
      searchArea.control.setValue("hey");
      fixture.detectChanges();

      expect(navigateSpy).toHaveBeenCalledTimes(0);

      tick(1000);

      expect(navigateSpy).toHaveBeenCalledOnceWith([], {
        queryParams: {
          filter: JSON.stringify({
            $or: [
              {
                test: {
                  $regex: "hey",
                  $options: "i"
                }
              }
            ]
          }),
          paginator: JSON.stringify({
            pageSize: fixture.componentInstance.paginator.pageSize,
            pageIndex: fixture.componentInstance.paginator.pageIndex,
            length: fixture.componentInstance.paginator.length
          }),
          sort: JSON.stringify(fixture.componentInstance.sort),
          language: JSON.stringify(fixture.componentInstance.language)
        }
      });
    }));
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
        .querySelector("table[mat-table] th[mat-header-cell].mat-column-test button")
        .click();

      fixture.detectChanges();

      const sortButton = document.body.querySelector(
        ".mat-menu-content button:nth-of-type(2)"
      ) as HTMLButtonElement;
      sortButton.click();

      fixture.detectChanges();

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
      fixture.debugElement.nativeElement
        .querySelector("table[mat-table] th[mat-header-cell].mat-column-test button")
        .click();

      fixture.detectChanges();

      const sortButton = document.body.querySelector(
        ".mat-menu-content button:nth-of-type(3)"
      ) as HTMLButtonElement;
      sortButton.click();

      fixture.detectChanges();

      expect(navigateSpy).toHaveBeenCalledTimes(1);
      expect(navigateSpy).toHaveBeenCalledWith([], {
        queryParams: {
          filter: "{}",
          paginator: JSON.stringify(fixture.componentInstance.defaultPaginatorOptions),
          sort: JSON.stringify({test: -1}),
          language: undefined
        }
      });
    });
  });

  describe("pagination", () => {
    let paginator: MatPaginator;

    beforeEach(() => {
      rows.next(new Array(40).fill({_id: "1", test: "123"}));
      fixture.detectChanges();
      paginator = fixture.debugElement.query(By.directive(MatPaginator)).injector.get(MatPaginator);
      bucketDataService.find.calls.reset();
    });

    it("should assign total count", () => {
      expect(paginator.length).toBe(40);
    });

    it("should change page", () => {
      paginator.nextPage();

      expect(navigateSpy).toHaveBeenCalledTimes(1);
      expect(navigateSpy).toHaveBeenCalledWith([], {
        queryParams: {
          paginator: JSON.stringify({previousPageIndex: 0, pageIndex: 1, pageSize: 25, length: 40}),
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
          paginator: JSON.stringify({previousPageIndex: 0, pageIndex: 0, pageSize: 5, length: 40}),
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
