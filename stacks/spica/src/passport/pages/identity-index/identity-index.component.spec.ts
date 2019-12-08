import {Component, TemplateRef} from "@angular/core";
import {ComponentFixture, TestBed} from "@angular/core/testing";
import {
  MatButtonModule,
  MatCardModule,
  MatIconModule,
  MatPaginator,
  MatPaginatorModule,
  MatTableModule,
  MatToolbarModule
} from "@angular/material";
import {By} from "@angular/platform-browser";
import {NoopAnimationsModule} from "@angular/platform-browser/animations";
import {RouterTestingModule} from "@angular/router/testing";
import {MatAwareDialogModule} from "@spica-client/material";
import {Subject} from "rxjs";
import {map} from "rxjs/operators";
import {Identity} from "../../interfaces/identity";
import {IdentityService} from "../../services/identity.service";
import {IdentityIndexComponent} from "./identity-index.component";

@Component({
  template: `
    <ng-container *ngTemplateOutlet="outlet"></ng-container>
  `
})
class ToolbarCmp {
  outlet: TemplateRef<any>;
}

describe("IdentityIndexComponent", () => {
  let fixture: ComponentFixture<IdentityIndexComponent>;
  const rows = new Subject<Partial<Identity>[]>();
  let identityService: jasmine.SpyObj<Pick<IdentityService, "find">>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [
        MatToolbarModule,
        MatButtonModule,
        MatIconModule,
        MatTableModule,
        MatAwareDialogModule,
        MatCardModule,
        MatPaginatorModule,
        NoopAnimationsModule,
        RouterTestingModule
      ],
      declarations: [IdentityIndexComponent, ToolbarCmp]
    });
    identityService = {
      find: jasmine
        .createSpy("find")
        .and.returnValue(rows.pipe(map(r => ({meta: {total: r.length}, data: r}))))
    };
    TestBed.overrideProvider(IdentityService, {useValue: identityService});
    fixture = TestBed.createComponent(IdentityIndexComponent);
    fixture.detectChanges();
  });

  describe("basic behavior", () => {
    let toolbarFixture: ComponentFixture<ToolbarCmp>;

    beforeEach(() => {
      toolbarFixture = TestBed.createComponent(ToolbarCmp);
      toolbarFixture.componentInstance.outlet = fixture.componentInstance.toolbar;
      toolbarFixture.detectChanges();
    });

    it("should refresh", () => {
      identityService.find.calls.reset();
      toolbarFixture.debugElement.query(By.css("button")).nativeElement.click();
      expect(identityService.find).toHaveBeenCalledTimes(1);
    });
  });

  describe("rows", () => {
    beforeEach(() => {
      rows.next([{_id: "1", identifier: "123"}]);
      fixture.detectChanges();
    });

    it("should render correctly", () => {
      const headerCells = fixture.debugElement.queryAll(
        By.css("mat-table mat-header-row mat-header-cell")
      );
      expect(headerCells[0].nativeElement.textContent).toBe(" # ");
      expect(headerCells[1].nativeElement.textContent).toBe("Identifier");
      expect(headerCells[2].nativeElement.textContent).toBe("Actions");

      const cells = fixture.debugElement.queryAll(By.css("mat-table mat-row mat-cell"));

      expect(cells[0].nativeElement.textContent).toBe("1");
      expect(cells[1].nativeElement.textContent).toBe("123");
    });

    it("should render actions correctly", () => {
      const lastCell = fixture.debugElement.query(
        By.css("mat-table mat-row mat-cell:last-of-type")
      );
      const [editButton, deleteButton] = lastCell.queryAll(By.css("button"));
      expect(editButton.nativeElement.textContent).toBe("edit");
      expect(deleteButton.nativeElement.textContent).toBe("delete");
    });
  });

  describe("pagination", () => {
    let paginator: MatPaginator;

    beforeEach(() => {
      rows.next(new Array(20).fill({_id: "1"}));
      fixture.detectChanges();
      paginator = fixture.debugElement.query(By.directive(MatPaginator)).injector.get(MatPaginator);
    });

    it("should assign total count", () => {
      expect(paginator.length).toBe(20);
    });

    it("should change page", () => {
      identityService.find.calls.reset();
      paginator.nextPage();
      expect(identityService.find).toHaveBeenCalledTimes(1);
      expect(identityService.find.calls.mostRecent().args[0]).toBe(10);
      expect(identityService.find.calls.mostRecent().args[1]).toBe(10);
    });

    it("should handle pageSize changes", () => {
      identityService.find.calls.reset();
      paginator._changePageSize(5);
      expect(identityService.find).toHaveBeenCalledTimes(1);
      expect(identityService.find.calls.mostRecent().args[0]).toBe(5);
      expect(identityService.find.calls.mostRecent().args[1]).toBe(0);
    });
  });
});
