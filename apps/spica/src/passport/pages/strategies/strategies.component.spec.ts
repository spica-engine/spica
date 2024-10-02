import {HttpClientTestingModule} from "@angular/common/http/testing";
import {Component, TemplateRef} from "@angular/core";
import {ComponentFixture, TestBed} from "@angular/core/testing";
import {MatButtonModule} from "@angular/material/button";
import {MatCardModule} from "@angular/material/card";
import {MatIconModule} from "@angular/material/icon";
import {MatPaginatorModule} from "@angular/material/paginator";
import {MatTableModule} from "@angular/material/table";
import {MatToolbarModule} from "@angular/material/toolbar";
import {By} from "@angular/platform-browser";
import {NoopAnimationsModule} from "@angular/platform-browser/animations";
import {RouterTestingModule} from "@angular/router/testing";
import {MatAwareDialogModule} from "@spica-client/material";
import {Subject} from "rxjs";
import {CanInteractDirectiveTest} from "@spica-client/passport/directives/can-interact.directive";
import {Strategy} from "../../interfaces/strategy";
import {StrategyService} from "../../services/strategy.service";
import {StrategiesComponent} from "./strategies.component";

@Component({
  template: `
    <ng-container *ngTemplateOutlet="outlet"></ng-container>
  `
})
class ToolbarCmp {
  outlet: TemplateRef<any>;
}

describe("StrategiesComponent", () => {
  let fixture: ComponentFixture<StrategiesComponent>;
  const rows = new Subject<Partial<Strategy>[]>();
  let strategyService: jasmine.SpyObj<Pick<StrategyService, "getStrategies">>;

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
      declarations: [StrategiesComponent, ToolbarCmp, CanInteractDirectiveTest]
    });
    strategyService = {
      getStrategies: jasmine.createSpy("getStrategies").and.returnValue(rows)
    };
    TestBed.overrideProvider(StrategyService, {useValue: strategyService});
    fixture = TestBed.createComponent(StrategiesComponent);
    fixture.detectChanges();
  });

  describe("rows", () => {
    beforeEach(() => {
      rows.next([{name: "Test", title: "Test title", icon: "test"}]);
      fixture.detectChanges();
    });

    it("should render correctly", () => {
      const headerCells = fixture.debugElement.queryAll(
        By.css("mat-table mat-header-row mat-header-cell")
      );
      expect(headerCells[0].nativeElement.textContent).toBe("Name");
      expect(headerCells[1].nativeElement.textContent).toBe("Title");
      expect(headerCells[2].nativeElement.textContent).toBe("Actions");

      const cells = fixture.debugElement.queryAll(By.css("mat-table mat-row mat-cell"));

      expect(cells[0].nativeElement.textContent).toBe("test Test ");
      expect(cells[1].nativeElement.textContent).toBe("Test title");
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
});
