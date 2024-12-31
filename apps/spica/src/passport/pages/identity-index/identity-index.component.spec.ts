import {Component, TemplateRef} from "@angular/core";
import {ComponentFixture, TestBed, tick} from "@angular/core/testing";
import {MatLegacyButtonModule as MatButtonModule} from "@angular/material/legacy-button";
import {MatLegacyCardModule as MatCardModule} from "@angular/material/legacy-card";
import {MatIconModule} from "@angular/material/icon";
import {MatPaginator, MatPaginatorModule} from "@angular/material/paginator";
import {MatLegacyTableModule as MatTableModule} from "@angular/material/legacy-table";
import {MatToolbarModule} from "@angular/material/toolbar";
import {By} from "@angular/platform-browser";
import {NoopAnimationsModule} from "@angular/platform-browser/animations";
import {RouterTestingModule} from "@angular/router/testing";
import {MatAwareDialogModule} from "@spica-client/material";
import {Subject, of} from "rxjs";
import {map} from "rxjs/operators";
import {CanInteractDirectiveTest} from "@spica-client/passport/directives/can-interact.directive";
import {Identity} from "../../interfaces/identity";
import {IdentityService} from "../../services/identity.service";
import {IdentityIndexComponent} from "./identity-index.component";
import {PreferencesService} from "@spica-client/core";
import {MatCheckboxModule} from "@angular/material/checkbox";
import {FormsModule} from "@angular/forms";
import {PolicyService} from "../../services/policy.service";
import {MatDividerModule} from "@angular/material/divider";

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
  let preferenceService: jasmine.SpyObj<Pick<PreferencesService, "get">>;
  let policyService: jasmine.SpyObj<Pick<PolicyService, "find">>;

  beforeEach(async () => {
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
        RouterTestingModule,
        MatCheckboxModule,
        FormsModule,
        MatDividerModule
      ],
      declarations: [IdentityIndexComponent, ToolbarCmp, CanInteractDirectiveTest]
    });

    identityService = {
      find: jasmine
        .createSpy("find")
        .and.returnValue(rows.pipe(map(r => ({meta: {total: r.length}, data: r}))))
    };
    preferenceService = {
      get: jasmine
        .createSpy("get")
        .and.returnValue(
          of({identity: {attributes: {properties: {age: {type: "number", title: "Age"}}}}})
        )
    };
    policyService = {
      find: jasmine.createSpy("find").and.returnValue(
        of({
          meta: {total: 2},
          data: [
            {_id: "PassportFullAccess", name: "Passport Full Access"},
            {_id: "BucketFullAccess", name: "Bucket Full Access"}
          ]
        })
      )
    };

    TestBed.overrideProvider(IdentityService, {useValue: identityService});
    TestBed.overrideProvider(PreferencesService, {useValue: preferenceService});
    TestBed.overrideProvider(PolicyService, {useValue: policyService});

    fixture = TestBed.createComponent(IdentityIndexComponent);
    fixture.detectChanges();
  });

  describe("rows", () => {
    beforeEach(() => {
      rows.next([
        {
          _id: "1",
          identifier: "spica",
          policies: ["PassportFullAccess", "BucketFullAccess"],
          attributes: {age: 20}
        }
      ]);
      fixture.detectChanges();
    });

    it("should render correctly", () => {
      const headerCells = fixture.debugElement
        .queryAll(By.css("table tr:first-of-type th:not(:first-of-type)"))
        .map(element => element.nativeElement.textContent);

      expect(headerCells[0]).toEqual(" _id ");
      expect(headerCells[1]).toEqual(" Identifier ");
      expect(headerCells[2]).toEqual(" Policies ");
      expect(headerCells[3]).toEqual(" Age ");
      expect(headerCells[4]).toEqual("Actions");

      const dataCells = fixture.debugElement
        .queryAll(By.css("table tr:first-of-type td:not(:first-of-type)"))
        .map(element => element.nativeElement.textContent);

      expect(dataCells[0]).toEqual(" 1 ");
      expect(dataCells[1]).toEqual("spica");
      expect(dataCells[2]).toEqual("Passport Full Access,Bucket Full Access");
      expect(dataCells[3]).toEqual("20");
    });

    it("should render actions correctly", () => {
      const lastCell = fixture.debugElement.query(By.css("table tr:first-of-type td:last-of-type"));

      const [editButton] = lastCell
        .queryAll(By.css("button"))
        .map(element => element.nativeElement.textContent);

      expect(editButton).toBe("edit");
    });
  });

  describe("pagination", () => {
    let paginator: MatPaginator;

    beforeEach(async () => {
      rows.next(
        new Array(20).fill({
          _id: "1",
          identifier: "spica",
          policies: ["PassportFullAccess", "BucketFullAccess"],
          attributes: {age: 20}
        })
      );
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
