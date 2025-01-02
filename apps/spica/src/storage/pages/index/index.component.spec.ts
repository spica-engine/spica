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
import {MatLegacyProgressSpinnerModule as MatProgressSpinnerModule} from "@angular/material/legacy-progress-spinner";
import {MatToolbarModule} from "@angular/material/toolbar";
import {MatTooltipModule} from "@angular/material/tooltip";
import {By} from "@angular/platform-browser";
import {NoopAnimationsModule} from "@angular/platform-browser/animations";
import {RouterTestingModule} from "@angular/router/testing";
import {MatAwareDialogModule, MatClipboardModule} from "@spica-client/material";
import {of} from "rxjs";
import {CanInteractDirectiveTest} from "@spica-client/passport/directives/can-interact.directive";
import {StorageViewComponent} from "../../components/storage-view/storage-view.component";
import {StorageService} from "../../services/storage.service";
import {RootDirService} from "../../services/root.dir.service";
import {IndexComponent} from "./index.component";
import {Storage, StorageNode} from "../../interfaces/storage";
import {ActivatedRoute} from "@angular/router";
import {Filters} from "../../helpers";

describe("Storage/IndexComponent", () => {
  let fixture: ComponentFixture<IndexComponent>;
  let storageService: jasmine.SpyObj<Partial<StorageService>>;
  let rootDirService: jasmine.SpyObj<Partial<RootDirService>>;
  let storageObjects: Storage[];

  beforeEach(async () => {
    storageObjects = [
      {
        _id: "1",
        name: "files/",
        content: {
          type: "",
          size: 0
        },
        url: "http://example/1"
      },
      {
        _id: "2",
        name: "files/test.png",
        content: {
          type: "image/png",
          size: 100_000
        },
        url: "http://example/2"
      },
      {
        _id: "3",
        name: "files/docs/",
        content: {
          type: "",
          size: 0
        },
        url: "http://example/3"
      },
      {
        _id: "4",
        name: "files/docs/doc.txt",
        content: {
          type: "text/plain",
          size: 100
        },
        url: "http://example/4"
      },
      {
        _id: "5",
        name: "others/",
        content: {
          type: "",
          size: 0
        },
        url: "http://example/5"
      }
    ];
    storageService = {
      getAll: jasmine.createSpy("getAll").and.callFake(params => {
        let result = storageObjects;

        const {filter, sort} = params;

        if (filter.$or) {
          result = result.filter(r => filter.$or.some(f => new RegExp(f.name.$regex).test(r.name)));
        }

        return of(result);
      }),
      insertMany: (() => {}) as any,
      delete: (() => {}) as any,
      listSubResources: jasmine.createSpy("listSubResources").and.callFake(fullname => {
        return of(storageObjects.filter(o => o.name.startsWith(fullname))).toPromise();
      })
    };
    rootDirService = {
      findAll: jasmine
        .createSpy("findAll")
        .and.returnValue(
          of(storageObjects.filter(s => Filters.ListRootDirs.name.$regex.match(s.name)))
        )
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
        RouterTestingModule,
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
        },
        {
          provide: RootDirService,
          useValue: rootDirService
        },
        {
          provide: ActivatedRoute,
          useValue: {
            params: of({name: "files"})
          }
        }
      ],
      declarations: [IndexComponent, StorageViewComponent, CanInteractDirectiveTest]
    });

    fixture = TestBed.createComponent(IndexComponent);
    fixture.detectChanges(false);

    await fixture.whenStable();
    fixture.detectChanges(false);
  });

  it("should list file and folders under the 'files' directory as initial state", () => {
    const columns = fixture.debugElement.queryAll(By.css(".column"));
    expect(columns.length).toEqual(1);

    const firstColumnLines = fixture.debugElement
      .queryAll(By.css(".column:nth-of-type(1) .line"))
      .map(el => el.nativeElement.textContent);

    expect(firstColumnLines.length).toEqual(2);
    expect(firstColumnLines[0]).toContain("test.png");
    expect(firstColumnLines[1]).toContain("docs");
  });

  it("should set nodes", () => {
    expect(fixture.componentInstance.nodes).toEqual([
      {
        _id: "1",
        name: "files",
        content: {
          type: "",
          size: 0
        },
        url: "http://example/1",
        parent: undefined as any,
        isDirectory: true,
        isHighlighted: true,
        index: 0,
        children: [
          {
            _id: "2",
            name: "test.png",
            content: {
              type: "image/png",
              size: 100_000
            },
            url: "http://example/2",
            parent: fixture.componentInstance.nodes[0],
            isDirectory: false,
            isHighlighted: false,
            index: 1,
            children: []
          },
          {
            _id: "3",
            name: "docs",
            content: {
              type: "",
              size: 0
            },
            url: "http://example/3",
            parent: fixture.componentInstance.nodes[0],
            isDirectory: true,
            isHighlighted: false,
            index: 2,
            children: [
              {
                _id: "4",
                name: "doc.txt",
                content: {
                  type: "text/plain",
                  size: 100
                },
                index: 3,
                url: "http://example/4",
                parent: fixture.componentInstance.nodes[0].children[1],
                children: [],
                isDirectory: false,
                isHighlighted: false
              }
            ]
          }
        ]
      },
      {
        _id: "5",
        name: "others",
        content: {
          type: "",
          size: 0
        },
        url: "http://example/5",
        children: [],
        isDirectory: true,
        isHighlighted: false,
        parent: undefined,
        index: 4
      }
    ]);
  });

  describe("expand folder", () => {
    beforeEach(fakeAsync(() => {
      const docsLine = fixture.debugElement
        .queryAll(By.css(".line"))
        .filter(el => el.nativeElement.textContent.indexOf("docs") != -1)[0].nativeElement;

      docsLine.click();

      fixture.detectChanges();
      tick();
    }));

    it("should expand docs folder", () => {
      const columns = fixture.debugElement.queryAll(By.css(".column"));
      expect(columns.length).toEqual(2);

      const firstColumnLines = fixture.debugElement
        .queryAll(By.css(".column:nth-of-type(1) .line"))
        .map(el => el.nativeElement.textContent);

      expect(firstColumnLines.length).toEqual(2);
      expect(firstColumnLines[0]).toContain("test.png");
      expect(firstColumnLines[1]).toContain("docs");

      const secondColumnLines = fixture.debugElement
        .queryAll(By.css(".column:nth-of-type(2) .line"))
        .map(el => el.nativeElement.textContent);

      expect(secondColumnLines.length).toEqual(1);
      expect(secondColumnLines[0]).toContain("doc.txt");
    });

    it("should update nodes", () => {
      expect(fixture.componentInstance.nodes).toEqual([
        {
          _id: "1",
          name: "files",
          content: {
            type: "",
            size: 0
          },
          url: "http://example/1",
          parent: undefined as any,
          isDirectory: true,
          isHighlighted: true,
          index: 0,
          children: [
            {
              _id: "2",
              name: "test.png",
              content: {
                type: "image/png",
                size: 100_000
              },
              url: "http://example/2",
              parent: fixture.componentInstance.nodes[0],
              isDirectory: false,
              isHighlighted: false,
              index: 1,
              children: []
            },
            {
              _id: "3",
              name: "docs",
              content: {
                type: "",
                size: 0
              },
              url: "http://example/3",
              parent: fixture.componentInstance.nodes[0],
              isDirectory: true,
              isHighlighted: true,
              index: 2,
              children: [
                {
                  _id: "4",
                  name: "doc.txt",
                  content: {
                    type: "text/plain",
                    size: 100
                  },
                  url: "http://example/4",
                  isDirectory: false,
                  isHighlighted: false,
                  parent: fixture.componentInstance.nodes[0].children.find(
                    n => n.name == "docs"
                  ) as StorageNode,
                  children: [],
                  index: 3
                }
              ]
            }
          ]
        },
        {
          _id: "5",
          name: "others",
          content: {
            type: "",
            size: 0
          },
          url: "http://example/5",
          children: [],
          isDirectory: true,
          isHighlighted: false,
          parent: undefined,
          index: 4
        }
      ]);
    });

    it("should upload file to the docs folder", fakeAsync(() => {
      const insertManySpy = spyOn(
        fixture.componentInstance["storageService"],
        "insertMany"
      ).and.returnValue(of());

      const files: any = [new File([], "myfile.png")];
      fixture.componentInstance.uploadStorageMany(files);
      tick();
      fixture.detectChanges();

      expect(insertManySpy).toHaveBeenCalledTimes(1);
      expect(insertManySpy).toHaveBeenCalledWith(files, "files/docs/");
    }));

    describe("collapse folder", () => {
      beforeEach(fakeAsync(() => {
        const firstColumn = fixture.debugElement.query(By.css(".column:nth-of-type(1)"))
          .nativeElement;

        firstColumn.click();

        fixture.detectChanges();
        tick();
      }));

      it("should collapse docs folder", () => {
        const columns = fixture.debugElement.queryAll(By.css(".column"));
        expect(columns.length).toEqual(1);

        const firstColumnLines = fixture.debugElement
          .queryAll(By.css(".column:nth-of-type(1) .line"))
          .map(el => el.nativeElement.textContent);

        expect(firstColumnLines.length).toEqual(2);
        expect(firstColumnLines[0]).toContain("test.png");
        expect(firstColumnLines[1]).toContain("docs");
      });

      it("should upload to the files directory", fakeAsync(() => {
        const insertManySpy = spyOn(
          fixture.componentInstance["storageService"],
          "insertMany"
        ).and.returnValue(of());

        const files: any = [new File([], "myfile.png")];
        fixture.componentInstance.uploadStorageMany(files);
        tick();
        fixture.detectChanges();

        expect(insertManySpy).toHaveBeenCalledTimes(1);
        expect(insertManySpy).toHaveBeenCalledWith(files, "files/");
      }));
    });
  });

  it("should show disabled add button while file uploading process in progress", () => {
    const event: HttpEvent<Storage> = {
      type: HttpEventType.UploadProgress,
      loaded: 10,
      total: 100
    };
    const insertSpy = spyOn(
      fixture.componentInstance["storageService"],
      "insertMany"
    ).and.returnValue(of(event));
    fixture.componentInstance.uploadStorageMany({length: 1} as any);
    fixture.detectChanges();

    expect(
      fixture.debugElement.query(By.css("mat-toolbar button:last-of-type")).nativeElement.disabled
    ).toBe(true);

    expect(insertSpy).toHaveBeenCalledTimes(1);
    expect(insertSpy).toHaveBeenCalledWith({length: 1} as any, "files/");
  });

  it("should complete upload progress", () => {
    const refreshSpy = spyOn(fixture.componentInstance.refresh, "next");
    const insertSpy = spyOn(
      fixture.componentInstance["storageService"],
      "insertMany"
    ).and.returnValue(of({type: HttpEventType.Response} as any));

    fixture.componentInstance.uploadStorageMany({length: 1} as any);
    fixture.detectChanges();

    expect(
      fixture.debugElement.query(By.css("mat-toolbar button:last-of-type")).nativeElement.disabled
    ).toBe(false);

    expect(insertSpy).toHaveBeenCalledTimes(1);
    expect(insertSpy).toHaveBeenCalledWith({length: 1} as any, "files/");

    expect(refreshSpy).toHaveBeenCalledTimes(1);
    expect(fixture.componentInstance.progress).toBe(undefined as any);
  });

  it("should delete data", fakeAsync(() => {
    const deleleteSpy = spyOn(
      fixture.componentInstance["storageService"],
      "delete"
    ).and.returnValue(of());

    const refreshSpy = spyOn(fixture.componentInstance.refresh, "next");

    fixture.componentInstance.delete("1");
    tick(500);
    fixture.detectChanges();

    expect(deleleteSpy).toHaveBeenCalledTimes(1);
    expect(deleleteSpy).toHaveBeenCalledWith("1");

    expect(refreshSpy).toHaveBeenCalledTimes(1);
  }));

  it("should delete docs directory and its subresources", fakeAsync(() => {
    const deleleteSpy = spyOn(
      fixture.componentInstance["storageService"],
      "delete"
    ).and.returnValue(of());

    fixture.componentInstance.deleteMany(["files/docs/"]);
    tick(500);
    fixture.detectChanges();

    expect(storageService.listSubResources).toHaveBeenCalledTimes(1);
    expect(storageService.listSubResources).toHaveBeenCalledWith("files/docs/", true);

    expect(deleleteSpy).toHaveBeenCalledTimes(2);
    expect(deleleteSpy.calls.allArgs()).toEqual([["3"], ["4"]]);
  }));

  it("should insert files to the current directory", fakeAsync(() => {
    const insertManySpy = spyOn(
      fixture.componentInstance["storageService"],
      "insertMany"
    ).and.returnValue(of());

    const files: any = [new File([], "myfile.png")];
    fixture.componentInstance.uploadStorageMany(files);
    tick();
    fixture.detectChanges();

    expect(insertManySpy).toHaveBeenCalledTimes(1);
    expect(insertManySpy).toHaveBeenCalledWith(files, "files/");
  }));

  it("should display image", fakeAsync(() => {
    const testPng = fixture.debugElement.query(By.css(".column:nth-child(1) .line")).nativeElement;
    testPng.click();

    fixture.detectChanges();
    tick();

    const storageView = fixture.debugElement.query(By.css(".object-details storage-view"))
      .nativeElement;
    expect(storageView.getAttribute("ng-reflect-blob")).toEqual("http://example/2");

    const sideView = fixture.debugElement.query(By.css(".object-details .meta")).nativeElement
      .textContent;

    expect(sideView).toContain("test.png");
    expect(sideView).toContain("image/png - 100 KB");
  }));

  describe("sorts", () => {
    beforeEach(() => {
      fixture.debugElement.query(By.css("mat-toolbar button:nth-of-type(1)")).nativeElement.click();
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
