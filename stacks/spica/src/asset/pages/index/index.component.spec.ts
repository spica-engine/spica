import {ComponentFixture, fakeAsync, TestBed, tick} from "@angular/core/testing";
import {AssetService} from "../../services/asset.service";
import {Asset} from "../../interfaces";
import {IndexComponent} from "./index.component";
import {MatDialog, MatDialogModule} from "@angular/material/dialog";
import {MatToolbarModule} from "@angular/material/toolbar";
import {MatIconModule} from "@angular/material/icon";
import {MatCardModule} from "@angular/material/card";
import {MatTableModule} from "@angular/material/table";
import {NoopAnimationsModule} from "@angular/platform-browser/animations";
import {MatButtonModule} from "@angular/material/button";
import {CanInteractDirectiveTest} from "@spica-client/passport/directives/can-interact.directive";
import {BrowserModule, By} from "@angular/platform-browser";
import {CommonModule} from "@angular/common";
import {BehaviorSubject, of, Subject} from "rxjs";

describe("IndexComponent", () => {
  let component: IndexComponent;
  let fixture: ComponentFixture<IndexComponent>;

  let matDialog: jasmine.SpyObj<Pick<MatDialog, "open">>;

  let afterClosed: Subject<any>;

  let assets: Asset[] = [];

  let assetService: jasmine.SpyObj<Pick<AssetService, "find" | "install" | "remove">>;

  let onAssetsChange: BehaviorSubject<Asset[]>;

  beforeEach(async () => {
    assets = [
      {
        _id: "1",
        url: "asset1.com",
        status: "downloaded",
        resources: [],
        configs: [],
        description: "Description of asset1",
        icon: "local_taxi",
        name: "Asset 1"
      },
      {
        _id: "2",
        url: "asset2.com",
        status: "installed",
        resources: [],
        configs: [],
        description: "Description of asset2",
        icon: "person",
        name: "Asset 2"
      },
      {
        _id: "3",
        url: "asset3.com",
        status: "partially_installed",
        resources: [],
        configs: [],
        description: "Description of asset3",
        icon: "fitness_center",
        name: "Asset 3"
      }
    ];

    onAssetsChange = new BehaviorSubject(assets);
    afterClosed = new Subject();

    assetService = {
      find: jasmine.createSpy("find").and.returnValue(onAssetsChange.asObservable()),
      install: jasmine.createSpy("install").and.callFake((_id, configs, preview) => {
        const index = assets.findIndex(a => a._id == _id);
        assets[index].status = "installed";

        onAssetsChange.next(assets);

        return of(null);
      }),
      remove: jasmine.createSpy("remove").and.callFake((_id, type: "soft" | "hard") => {
        const index = assets.findIndex(a => a._id == _id);

        if (type == "soft") {
          assets[index].status = "downloaded";
        } else if (type == "hard") {
          assets.splice(index, 1);
        } else {
          return Promise.reject(`Unknown deletion type recevied: ${type}`);
        }

        onAssetsChange.next(assets);
        return of(null);
      })
    };

    matDialog = {
      open: jasmine.createSpy("open").and.returnValue({
        afterClosed: () => afterClosed.asObservable()
      })
    };

    await TestBed.configureTestingModule({
      imports: [
        MatDialogModule,
        MatToolbarModule,
        MatIconModule,
        MatCardModule,
        MatTableModule,
        MatButtonModule,
        NoopAnimationsModule,
        CommonModule,
        BrowserModule
      ],
      declarations: [IndexComponent, CanInteractDirectiveTest],
      providers: [
        {
          provide: AssetService,
          useValue: assetService
        },
        {
          provide: MatDialog,
          useValue: matDialog
        }
      ]
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(IndexComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should list assets", () => {
    const headerCells = fixture.debugElement.nativeElement.querySelectorAll(
      ".mat-mdc-table mat-header-row mat-header-cell"
    );

    const dataCells = fixture.debugElement.nativeElement.querySelectorAll(
      ".mat-mdc-table mat-row mat-cell"
    );

    expect(headerCells[0].textContent).toBe("Id");
    expect(headerCells[1].textContent).toBe("Name");
    expect(headerCells[2].textContent).toBe("Status");
    expect(headerCells[3].textContent).toBe("Actions");

    expect(dataCells[0].textContent).toBe("1");
    expect(dataCells[1].textContent).toBe("Asset 1");
    expect(dataCells[2].textContent).toBe(" Downloaded ");
    expect(dataCells[3].textContent).toContain("play_arrow");
    expect(dataCells[3].textContent).toContain("delete");

    expect(dataCells[4].textContent).toBe("2");
    expect(dataCells[5].textContent).toBe("Asset 2");
    expect(dataCells[6].textContent).toBe(" Installed ");
    expect(dataCells[7].textContent).toContain("stop_circle");
    expect(dataCells[7].textContent).toContain("delete");

    expect(dataCells[8].textContent).toBe("3");
    expect(dataCells[9].textContent).toBe("Asset 3");
    expect(dataCells[10].textContent).toBe(" Partially Installed info");
    expect(dataCells[11].textContent).toContain("stop_circle");
    expect(dataCells[11].textContent).toContain("delete");
  });

  it("should install asset", fakeAsync(() => {
    const [installButton] = fixture.debugElement.nativeElement.querySelectorAll(
      ".mat-mdc-table mat-row mat-cell.mat-column-actions button"
    );
    installButton.click();

    expect(matDialog.open).toHaveBeenCalledTimes(1);
    expect(matDialog.open.calls.first().args[1].data).toEqual({asset: assets[0]});

    afterClosed.next(assets[0]);
    afterClosed.complete();

    expect(assetService.install).toHaveBeenCalledTimes(1);
    expect(assetService.install.calls.first().args).toEqual([
      assets[0]._id,
      assets[0].configs,
      false
    ]);

    tick();
    fixture.detectChanges();

    const dataCells = fixture.debugElement.nativeElement.querySelectorAll(
      ".mat-mdc-table mat-row mat-cell"
    );

    expect(dataCells[0].textContent).toBe("1");
    expect(dataCells[1].textContent).toBe("Asset 1");
    expect(dataCells[2].textContent).toBe(
      " Installed ",
      "if it's status changed from downloaded to installed"
    );
    expect(dataCells[3].textContent).toContain("stop_circle");
    expect(dataCells[3].textContent).toContain("delete");
  }));

  it("should soft delete asset", fakeAsync(() => {
    const stopButton = fixture.debugElement.nativeElement.querySelector(
      ".mat-mdc-table mat-row:nth-of-type(2) mat-cell.mat-column-actions button:nth-of-type(1)"
    );
    stopButton.click();

    expect(matDialog.open).toHaveBeenCalledTimes(1);
    expect((matDialog.open.calls.first().args[1].data as any).answer).toEqual("Asset 2");

    afterClosed.next(true);
    afterClosed.complete();

    expect(assetService.remove).toHaveBeenCalledTimes(1);
    expect(assetService.remove.calls.first().args).toEqual([assets[1]._id, "soft"]);

    tick();
    fixture.detectChanges();

    const dataCells = fixture.debugElement.nativeElement.querySelectorAll(
      ".mat-mdc-table mat-row mat-cell"
    );

    expect(dataCells[4].textContent).toBe("2");
    expect(dataCells[5].textContent).toBe("Asset 2");
    expect(dataCells[6].textContent).toBe(
      " Downloaded ",
      "if it's status changed from installed to downloaded"
    );
    expect(dataCells[7].textContent).toContain("play_arrow");
    expect(dataCells[7].textContent).toContain("delete");
  }));

  it("should hard delete asset", fakeAsync(() => {
    const deleteButton = fixture.debugElement.nativeElement.querySelector(
      ".mat-mdc-table mat-row:nth-of-type(3) mat-cell.mat-column-actions button:nth-of-type(3)"
    );
    deleteButton.click();

    expect(matDialog.open).toHaveBeenCalledTimes(1);
    expect((matDialog.open.calls.first().args[1].data as any).answer).toEqual("Asset 3");

    afterClosed.next(true);
    afterClosed.complete();

    expect(assetService.remove).toHaveBeenCalledTimes(1);
    expect(assetService.remove.calls.first().args).toEqual(["3", "hard"]);

    tick();
    fixture.detectChanges();

    const dataCells = fixture.debugElement.nativeElement.querySelectorAll(
      ".mat-mdc-table mat-row mat-cell"
    );

    expect(dataCells.length).toEqual(8, "should be 8 if last asset has been deleted successfully.");

    expect(dataCells[0].textContent).toBe("1");
    expect(dataCells[1].textContent).toBe("Asset 1");
    expect(dataCells[2].textContent).toBe(" Downloaded ");
    expect(dataCells[3].textContent).toContain("play_arrow");
    expect(dataCells[3].textContent).toContain("delete");

    expect(dataCells[4].textContent).toBe("2");
    expect(dataCells[5].textContent).toBe("Asset 2");
    expect(dataCells[6].textContent).toBe(" Installed ");
    expect(dataCells[7].textContent).toContain("stop_circle");
    expect(dataCells[7].textContent).toContain("delete");
  }));
});
