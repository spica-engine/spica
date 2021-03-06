import {BreakpointObserver, Breakpoints} from "@angular/cdk/layout";
import {HttpEvent, HttpEventType} from "@angular/common/http";
import {HttpClientTestingModule} from "@angular/common/http/testing";
import {ComponentFixture, fakeAsync, TestBed, tick} from "@angular/core/testing";
import {FormsModule} from "@angular/forms";
import {MatCardModule} from "@angular/material/card";
import {MatDialog} from "@angular/material/dialog";
import {MatFormFieldModule} from "@angular/material/form-field";
import {MatGridListModule} from "@angular/material/grid-list";
import {MatIconModule} from "@angular/material/icon";
import {MatMenuModule} from "@angular/material/menu";
import {MatPaginator, MatPaginatorModule} from "@angular/material/paginator";
import {MatProgressSpinnerModule} from "@angular/material/progress-spinner";
import {MatToolbarModule} from "@angular/material/toolbar";
import {MatTooltipModule} from "@angular/material/tooltip";
import {By} from "@angular/platform-browser";
import {NoopAnimationsModule} from "@angular/platform-browser/animations";
import {RouterTestingModule} from "@angular/router/testing";
import {MatAwareDialogModule, MatClipboardModule} from "@spica-client/material";
import {of} from "rxjs";
import {CanInteractDirectiveTest} from "@spica-client/passport/directives/can-interact.directive";
import {ImageEditorComponent} from "../../components/image-editor/image-editor.component";
import {StorageDialogOverviewDialog} from "../../components/storage-dialog-overview/storage-dialog-overview";
import {StorageViewComponent} from "../../components/storage-view/storage-view.component";
import {StorageService} from "../../storage.service";
import {IndexComponent} from "./index.component";
import {DebugElement} from "@angular/core";

describe("Storage/IndexComponent", () => {
  let fixture: ComponentFixture<IndexComponent>;
  let storageService: jasmine.SpyObj<Partial<StorageService>>;

  beforeEach(async () => {
    storageService = {
      getAll: jasmine.createSpy("getAll").and.returnValue(
        of({
          meta: {total: 10000},
          data: [
            {
              _id: "1",
              name: "test1",
              content: {
                type: "image/png"
              },
              url: "http://example/test.png"
            },
            {
              _id: "2",
              name: "test2",
              content: {
                type: "text/txt"
              },
              url: "http://example/test2.txt"
            },
            {
              _id: "3",
              name: "test3",
              content: {
                type: "video/mp4"
              },
              url: "http://example/test3.mp4"
            }
          ]
        })
      ),
      insertMany: null,
      delete: null
    };
    TestBed.configureTestingModule({
      imports: [
        MatIconModule,
        MatMenuModule,
        FormsModule,
        MatProgressSpinnerModule,
        MatCardModule,
        MatIconModule,
        MatToolbarModule,
        MatGridListModule,
        MatFormFieldModule,
        MatTooltipModule,
        RouterTestingModule.withRoutes([{path: "1", component: IndexComponent}]),
        MatPaginatorModule,
        MatAwareDialogModule,
        MatClipboardModule,
        HttpClientTestingModule,
        NoopAnimationsModule
      ],
      providers: [
        {
          provide: MatDialog,
          useValue: {
            open: jasmine.createSpy("open").and.returnValue({
              afterClosed: jasmine.createSpy("afterClosed").and.returnValue(of(null))
            })
          }
        },
        {
          provide: BreakpointObserver,
          useValue: {
            observe: jasmine.createSpy("observe").and.returnValue(of(null)),
            isMatched: jasmine
              .createSpy("isMatched", (arg: any) => {
                return arg == Breakpoints.Medium ? true : false;
              })
              .and.callThrough()
          }
        },
        {
          provide: StorageService,
          useValue: storageService
        }
      ],
      declarations: [IndexComponent, StorageViewComponent, CanInteractDirectiveTest]
    });

    fixture = TestBed.createComponent(IndexComponent);
    fixture.detectChanges(false);

    await fixture.whenStable();
    fixture.detectChanges(false);
  });

  describe("basic behaviours", () => {
    it("should show name of first data on storage", () => {
      expect(
        fixture.debugElement.query(
          By.css("mat-grid-list mat-grid-tile:nth-child(1) mat-card mat-card-actions mat-label")
        ).nativeElement.textContent
      ).toBe("test1");
    });

    it("should define col number", () => {
      expect(fixture.componentInstance.cols).toBe(
        4,
        "should define this value as 4 if current breakpoint value is Medium"
      );
    });
  });

  describe("actions", () => {
    it("show navigate to the edit page", fakeAsync(() => {
      fixture.debugElement
        .query(
          By.css("mat-grid-list mat-grid-tile:nth-child(1) mat-card mat-card-actions mat-menu")
        )
        .nativeElement.click();
      fixture.detectChanges(false);

      const editButton = document.body.querySelector("div.mat-menu-content button:nth-of-type(2)");
      expect(
        document.body.querySelector("div.mat-menu-content button:nth-of-type(2)").textContent
      ).toContain("Edit", "should show edit button if this data content type is image");

      (editButton as HTMLElement).click();
      tick(500);
      fixture.detectChanges();

      expect(fixture.componentInstance.dialog.open).toHaveBeenCalledTimes(1);
      expect(fixture.componentInstance.dialog.open).toHaveBeenCalledWith(ImageEditorComponent, {
        maxWidth: "80%",
        maxHeight: "80%",
        panelClass: "edit-object",
        data: {
          _id: "1",
          name: "test1",
          content: {
            type: "image/png"
          },
          url: `http://example/test.png`
        }
      });
    }));

    it("should show disabled add button while file uploading process in progress", () => {
      const event: HttpEvent<Storage> = {
        type: HttpEventType.UploadProgress,
        loaded: 10,
        total: 100
      };
      const insertSpy = spyOn(fixture.componentInstance["storage"], "insertMany").and.returnValue(
        of(event)
      );
      fixture.componentInstance.uploadStorageMany({} as any);
      fixture.detectChanges();

      expect(
        fixture.debugElement.query(By.css("mat-toolbar button:last-of-type")).nativeElement.disabled
      ).toBe(true);

      expect(insertSpy).toHaveBeenCalledTimes(1);
      expect(insertSpy).toHaveBeenCalledWith({} as any);
    });

    it("should complete upload progress", () => {
      const refreshSpy = spyOn(fixture.componentInstance.refresh, "next");
      const insertSpy = spyOn(fixture.componentInstance["storage"], "insertMany").and.returnValue(
        of({type: HttpEventType.Response} as any)
      );

      fixture.componentInstance.uploadStorageMany({} as any);
      fixture.detectChanges();

      expect(
        fixture.debugElement.query(By.css("mat-toolbar button:last-of-type")).nativeElement.disabled
      ).toBe(false);

      expect(insertSpy).toHaveBeenCalledTimes(1);
      expect(insertSpy).toHaveBeenCalledWith({} as any);

      expect(refreshSpy).toHaveBeenCalledTimes(1);
      expect(fixture.componentInstance.progress).toBe(undefined);
    });

    it("should delete data", fakeAsync(() => {
      const deleleteSpy = spyOn(fixture.componentInstance["storage"], "delete").and.returnValue(
        of(null)
      );

      const refreshSpy = spyOn(fixture.componentInstance.refresh, "next");

      fixture.componentInstance.delete("1");
      tick(500);
      fixture.detectChanges();

      expect(deleleteSpy).toHaveBeenCalledTimes(1);
      expect(deleleteSpy).toHaveBeenCalledWith("1");

      expect(refreshSpy).toHaveBeenCalledTimes(1);
    }));

    describe("selection mode", () => {
      let cards: DebugElement[] = [];
      beforeEach(() => {
        const selectButton = fixture.debugElement.query(
          By.css("mat-toolbar div.actions button:first-of-type")
        ).nativeElement;

        selectButton.click();
        fixture.detectChanges();

        cards = fixture.debugElement.queryAll(By.css("mat-grid-list mat-grid-tile mat-card"));
      });

      it("should switch selection mode on", () => {
        expect(fixture.componentInstance.selectionActive).toEqual(true);
        expect(fixture.componentInstance.selectedStorageIds).toEqual([]);

        expect(
          fixture.debugElement.query(By.css("mat-toolbar div.actions button:nth-of-type(1)"))
            .nativeElement.textContent
        ).toEqual("cancel Cancel ");

        expect(
          fixture.debugElement.query(By.css("mat-toolbar div.actions button:nth-of-type(2)"))
            .nativeElement.textContent
        ).toEqual("select_all Select All ");

        expect(
          cards.map(card =>
            (card.nativeElement as HTMLElement).classList.toString().includes("unselected")
          )
        ).toEqual([true, true, true]);

        // disabling child elements events when selection mode on
        expect(
          cards.map(
            card => card.query(By.css("mat-card-content")).nativeElement.style["pointer-events"]
          )
        ).toEqual(["none", "none", "none"]);

        expect(
          cards.map(
            card => card.query(By.css("mat-card-actions")).nativeElement.style["pointer-events"]
          )
        ).toEqual(["none", "none", "none"]);
      });

      it("should select and deselect objects, but keep their pointer-events none", () => {
        cards[0].nativeElement.click();
        cards[1].nativeElement.click();
        fixture.detectChanges();

        expect(fixture.componentInstance.selectedStorageIds).toEqual(["1", "2"]);

        expect(
          cards.map(card =>
            (card.nativeElement as HTMLElement).classList.toString().includes("unselected")
          )
        ).toEqual([false, false, true]);

        cards[0].nativeElement.click();
        fixture.detectChanges();

        expect(fixture.componentInstance.selectedStorageIds).toEqual(["2"]);

        expect(
          cards.map(card =>
            (card.nativeElement as HTMLElement).classList.toString().includes("unselected")
          )
        ).toEqual([true, false, true]);

        expect(
          cards.map(
            card => card.query(By.css("mat-card-content")).nativeElement.style["pointer-events"]
          )
        ).toEqual(["none", "none", "none"]);

        expect(
          cards.map(
            card => card.query(By.css("mat-card-actions")).nativeElement.style["pointer-events"]
          )
        ).toEqual(["none", "none", "none"]);
      });

      it("should cancel selections and switch selection mode off", () => {
        cards[0].nativeElement.click();
        fixture.debugElement
          .query(By.css("mat-toolbar div.actions button:nth-of-type(1)"))
          .nativeElement.click();
        fixture.detectChanges();

        expect(fixture.componentInstance.selectionActive).toEqual(false);
        expect(fixture.componentInstance.selectedStorageIds).toEqual([]);

        expect(
          cards.map(card =>
            (card.nativeElement as HTMLElement).classList.toString().includes("unselected")
          )
        ).toEqual([false, false, false]);

        expect(
          cards.map(
            card => card.query(By.css("mat-card-content")).nativeElement.style["pointer-events"]
          )
        ).toEqual(["initial", "initial", "initial"]);

        expect(
          cards.map(
            card => card.query(By.css("mat-card-actions")).nativeElement.style["pointer-events"]
          )
        ).toEqual(["initial", "initial", "initial"]);
      });

      it("should select all", () => {
        fixture.debugElement
          .query(By.css("mat-toolbar div.actions button:nth-of-type(2)"))
          .nativeElement.click();
        fixture.detectChanges();

        expect(fixture.componentInstance.selectedStorageIds).toEqual(["1", "2", "3"]);

        expect(
          cards.map(card =>
            (card.nativeElement as HTMLElement).classList.toString().includes("unselected")
          )
        ).toEqual([false, false, false]);
      });

      it("should delete selected objects ", fakeAsync(() => {
        const deleleteSpy = spyOn(fixture.componentInstance["storage"], "delete").and.returnValue(
          of(null)
        );
        const refreshSpy = spyOn(fixture.componentInstance.refresh, "next");

        fixture.componentInstance.selectedStorageIds = ["1", "2"];
        fixture.componentInstance.deleteMany();

        tick(500);
        fixture.detectChanges();

        expect(deleleteSpy).toHaveBeenCalledTimes(2);
        expect(deleleteSpy.calls.allArgs()).toEqual([["1"], ["2"]]);

        expect(refreshSpy).toHaveBeenCalledTimes(1);
      }));
    });

    it("should open preview", () => {
      fixture.debugElement
        .query(
          By.css("mat-grid-list mat-grid-tile:nth-child(1) mat-card mat-card-content storage-view")
        )
        .nativeElement.click();
      fixture.detectChanges();

      expect(fixture.componentInstance.dialog.open).toHaveBeenCalledTimes(1);
      expect(fixture.componentInstance.dialog.open).toHaveBeenCalledWith(
        StorageDialogOverviewDialog,
        {
          maxWidth: "80%",
          maxHeight: "80%",
          panelClass: "preview-object",
          data: {
            _id: "1",
            name: "test1",
            content: {
              type: "image/png"
            },
            url: `http://example/test.png`
          }
        }
      );
    });

    describe("sorts", () => {
      beforeEach(() => {
        fixture.debugElement
          .query(By.css("mat-toolbar button:nth-of-type(2)"))
          .nativeElement.click();
        fixture.detectChanges(false);
      });

      it("should create parameter to sort descend by name", () => {
        (document.body.querySelector(
          "div.mat-menu-content button:nth-child(1)"
        ) as HTMLButtonElement).click();
        fixture.detectChanges();

        expect(fixture.componentInstance.sorter).toEqual({
          name: -1
        });
      });

      it("should create parameter to sort ascend by name", () => {
        (document.body.querySelector(
          "div.mat-menu-content button:nth-child(2)"
        ) as HTMLButtonElement).click();
        fixture.detectChanges();

        expect(fixture.componentInstance.sorter).toEqual({
          name: 1
        });
      });

      it("should create parameter to sort descend by date", () => {
        (document.body.querySelector(
          "div.mat-menu-content button:nth-child(3)"
        ) as HTMLButtonElement).click();
        fixture.detectChanges();

        expect(fixture.componentInstance.sorter).toEqual({
          _id: -1
        });
      });

      it("should create parameter to sort ascend by name", () => {
        (document.body.querySelector(
          "div.mat-menu-content button:nth-child(4)"
        ) as HTMLButtonElement).click();
        fixture.detectChanges();

        expect(fixture.componentInstance.sorter).toEqual({
          _id: 1
        });
      });
    });
  });

  describe("pagination", () => {
    let paginator: MatPaginator;

    beforeEach(() => {
      paginator = fixture.debugElement.query(By.directive(MatPaginator)).injector.get(MatPaginator);
    });

    it("it should show paginator size", fakeAsync(() => {
      expect(fixture.componentInstance.paginator.length).toBe(10000);
      expect(
        fixture.debugElement.query(By.css("div.mat-paginator-range-label")).nativeElement
          .textContent
      ).toBe(" 1 – 12 of 10000 ");
    }));
    it("should change page", () => {
      paginator.nextPage();
      fixture.detectChanges();
      expect(
        fixture.debugElement.query(By.css("div.mat-paginator-range-label")).nativeElement
          .textContent
      ).toBe(" 13 – 24 of 10000 ");
    });
    it("should change page size", () => {
      paginator._changePageSize(24);
      fixture.detectChanges();
      expect(
        fixture.debugElement.query(By.css("div.mat-paginator-range-label")).nativeElement
          .textContent
      ).toBe(" 1 – 24 of 10000 ");
    });
  });
});
