import {HttpClientTestingModule} from "@angular/common/http/testing";
import {Component, TemplateRef} from "@angular/core";
import {ComponentFixture, TestBed} from "@angular/core/testing";
import {MatButtonModule} from "@angular/material/button";
import {MatCardModule} from "@angular/material/card";
import {MatIconModule} from "@angular/material/icon";
import {MatPaginator, MatPaginatorModule} from "@angular/material/paginator";
import {MatTableModule} from "@angular/material/table";
import {MatToolbarModule} from "@angular/material/toolbar";
import {By} from "@angular/platform-browser";
import {NoopAnimationsModule} from "@angular/platform-browser/animations";
import {RouterTestingModule} from "@angular/router/testing";
import {MatAwareDialogModule} from "@spica-client/material/aware-dialog";
import {Subject} from "rxjs";
import {map} from "rxjs/operators";
import {Policy} from "../../interfaces/policy";
import {IdentityService} from "../../services/identity.service";
import {PolicyService} from "../../services/policy.service";
import {PolicyIndexComponent} from "./policy-index.component";
import {CanInteractDirectiveTest} from "@spica-client/passport/directives/can-interact.directive";

@Component({
  template: ` <ng-container *ngTemplateOutlet="outlet"></ng-container> `
})
class ToolbarCmp {
  outlet: TemplateRef<any>;
}

describe("PolicyIndexComponent", () => {
  let fixture: ComponentFixture<PolicyIndexComponent>;
  const rows = new Subject<Partial<Policy>[]>();
  let policyService: jasmine.SpyObj<Pick<IdentityService, "find">>;

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
        HttpClientTestingModule,
        NoopAnimationsModule,
        RouterTestingModule
      ],
      declarations: [PolicyIndexComponent, ToolbarCmp, CanInteractDirectiveTest]
    });
    policyService = {
      find: jasmine
        .createSpy("find")
        .and.returnValue(rows.pipe(map(r => ({meta: {total: r.length}, data: r}))))
    };
    TestBed.overrideProvider(PolicyService, {useValue: policyService});
    fixture = TestBed.createComponent(PolicyIndexComponent);
    fixture.detectChanges();
  });

  describe("rows", () => {
    beforeEach(() => {
      rows.next([
        {_id: "1", name: "Test", description: "Test Description"},
        {_id: "2", name: "Test", description: "Test Description", system: true}
      ]);
      fixture.detectChanges();
    });

    it("should render correctly", () => {
      const headerCells = fixture.debugElement.queryAll(
        By.css("mat-table mat-header-row mat-header-cell")
      );
      expect(headerCells[0].nativeElement.textContent).toBe(" # ");
      expect(headerCells[1].nativeElement.textContent).toBe("Name");
      expect(headerCells[2].nativeElement.textContent).toBe("Description");
      expect(headerCells[3].nativeElement.textContent).toBe("Actions");

      const cells = fixture.debugElement.queryAll(By.css("mat-table mat-row mat-cell"));

      expect(cells[0].nativeElement.textContent).toBe("1");
      expect(cells[1].nativeElement.textContent).toBe("Test");
      expect(cells[2].nativeElement.textContent).toBe("Test Description");
    });

    it("should render actions correctly", () => {
      const lastCell = fixture.debugElement.query(
        By.css("mat-table mat-row mat-cell:last-of-type")
      );
      const [editButton, deleteButton] = lastCell.queryAll(By.css("button"));
      expect(editButton.nativeElement.textContent).toBe("edit");
      expect(deleteButton.nativeElement.textContent).toBe("delete");
    });

    it("should render actions correctly for predefined policies", () => {
      const lastCell = fixture.debugElement.query(
        By.css("mat-table mat-row:last-of-type mat-cell:last-of-type")
      );
      const [editButton, deleteButton] = lastCell.queryAll(By.css("button"));
      expect(editButton.nativeElement.textContent).toBe("file_copy");
      expect(deleteButton.nativeElement.textContent).toBe("lock");
    });
  });

  describe("pagination", () => {
    let paginator: MatPaginator;

    beforeEach(() => {
      rows.next(new Array(120).fill({_id: "1"}));
      fixture.detectChanges();
      paginator = fixture.debugElement.query(By.directive(MatPaginator)).injector.get(MatPaginator);
    });

    it("should assign total count", () => {
      expect(paginator.length).toBe(120);
    });

    it("should change page", () => {
      policyService.find.calls.reset();
      paginator.nextPage();
      expect(policyService.find).toHaveBeenCalledTimes(1);
      expect(policyService.find.calls.mostRecent().args[0]).toBe(100);
      expect(policyService.find.calls.mostRecent().args[1]).toBe(100);
    });

    it("should handle pageSize changes", () => {
      policyService.find.calls.reset();
      paginator._changePageSize(5);
      expect(policyService.find).toHaveBeenCalledTimes(1);
      expect(policyService.find.calls.mostRecent().args[0]).toBe(5);
      expect(policyService.find.calls.mostRecent().args[1]).toBe(0);
    });
  });
});
