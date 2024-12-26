import {CommonModule} from "@angular/common";
import {Component, Input} from "@angular/core";
import {ComponentFixture, TestBed} from "@angular/core/testing";
import {FormsModule} from "@angular/forms";
import {MatButtonModule} from "@angular/material/button";
import {MatCardModule} from "@angular/material/card";
import {MatFormFieldModule} from "@angular/material/form-field";
import {MatIconModule} from "@angular/material/icon";
import {MatMenuModule} from "@angular/material/menu";
import {MatPaginatorModule} from "@angular/material/paginator";
import {MatTableModule} from "@angular/material/table";
import {MatTooltip, MatTooltipModule} from "@angular/material/tooltip";
import {By} from "@angular/platform-browser";
import {NoopAnimationsModule} from "@angular/platform-browser/animations";
import {RouterTestingModule} from "@angular/router/testing";
import {INPUT_SCHEMA, MapPipe} from "@spica-client/common";
import {of} from "rxjs";
import {BucketDataService} from "../../services/bucket-data.service";
import {BucketService} from "../../services/bucket.service";
import {RelationComponent} from "./relation.component";

@Component({
  selector: "bucket-filter",
  template: ""
})
class DummyBucketFilterComponent {
  @Input() schema: unknown;
  @Input() filter: unknown;
}

describe("Relation Component", () => {
  let fixture: ComponentFixture<RelationComponent>;
  let bucketDataService: jasmine.SpyObj<BucketDataService>;
  let bucketService: jasmine.SpyObj<BucketService>;
  let onChangeSpy: jasmine.Spy<typeof fixture.componentInstance.onChangeFn>;

  beforeEach(() => {
    bucketDataService = jasmine.createSpyObj("BucketDataService", ["find"]);
    bucketService = jasmine.createSpyObj("BucketService", ["getBucket"]);
    TestBed.configureTestingModule({
      imports: [
        NoopAnimationsModule,
        CommonModule,
        MatIconModule,
        MatTableModule,
        MatPaginatorModule,
        MatMenuModule,
        MatCardModule,
        MatFormFieldModule,
        MatButtonModule,
        MatTooltipModule,
        FormsModule,
        RouterTestingModule
      ],
      providers: [
        {
          provide: INPUT_SCHEMA,
          useValue: {
            type: "relation",
            bucketId: "",
            description: "Description of the relation"
          }
        },
        {
          provide: BucketDataService,
          useValue: bucketDataService
        },
        {
          provide: BucketService,
          useValue: bucketService
        }
      ],
      declarations: [RelationComponent, DummyBucketFilterComponent, MapPipe]
    });
    fixture = TestBed.createComponent(RelationComponent);
    onChangeSpy = spyOn(fixture.componentInstance, "onChangeFn");
    bucketService.getBucket.and.returnValue(
      of({
        _id: "",
        primary: "name",
        icon: "anicon",
        title: "Wallet",
        properties: {
          name: {
            type: "string",
            title: "Name"
          }
        }
      })
    );
    bucketDataService.find.and.callFake((_, options) => {
      const rows = [
        {
          _id: "1",
          name: "Wallet 1"
        },
        {
          _id: "2",
          name: "Wallet 2"
        }
      ];
      let data = rows;
      if (options.filter) {
        data = data.filter(r => options.filter._id.$in.indexOf(r._id) > -1);
      }
      return of({meta: {total: rows.length}, data: data});
    });

    fixture.detectChanges();
  });

  it("should render description", () => {
    const hint = fixture.debugElement.query(By.css(".mat-mdc-hint"));
    expect(hint.nativeElement.textContent).toBe("Description of the relation");
  });

  it("should show picker button", () => {
    const button = fixture.debugElement.query(By.css("section button"));
    expect(button.nativeElement.textContent).toBe("anicon Select from Wallet ");
  });

  it("should open the relation picker", () => {
    const button = fixture.debugElement.query(By.css("section button"));
    button.triggerEventHandler("click", undefined);
    fixture.detectChanges();
    const panel = document.querySelector(".mat-mdc-menu-panel");
    expect(panel).toBeTruthy();
  });

  it("should pick a row and render changes and propagate", () => {
    const button = fixture.debugElement.query(By.css("section button"));
    button.triggerEventHandler("click", undefined);
    fixture.detectChanges();

    const pickButton = document.querySelector(".mat-mdc-menu-panel mat-cell button");
    pickButton.dispatchEvent(new MouseEvent("click"));
    fixture.detectChanges();

    const row = fixture.debugElement.query(By.css("section div button"));
    const tooltip = row.injector.get(MatTooltip);

    expect(tooltip.message).toBe("name of the row");
    expect(row.nativeElement.textContent).toBe("anicon Wallet 1 ");
    expect(onChangeSpy).toHaveBeenCalledWith("1");
  });

  it("should not render remove button in one to one mode", () => {
    fixture.debugElement.query(By.css("section button")).triggerEventHandler("click", undefined);
    fixture.detectChanges();
    document
      .querySelector(".mat-mdc-menu-panel mat-cell button")
      .dispatchEvent(new MouseEvent("click"));

    const buttons = fixture.debugElement.queryAll(By.css("section div button"));
    expect(buttons.length).toBe(0);
  });

  it("should clear selected row(s)", () => {
    fixture.componentInstance.value = {_id: "1"};
    fixture.detectChanges();
    expect(onChangeSpy).not.toHaveBeenCalled();

    fixture.debugElement
      .query(By.css("section > button:last-of-type"))
      .triggerEventHandler("click", undefined);

    fixture.detectChanges();
    const row = fixture.debugElement.query(By.css("section div button"));

    expect(row).not.toBeTruthy();
    expect(onChangeSpy).toHaveBeenCalledWith(undefined);
  });

  describe("many to many", () => {
    beforeEach(() => {
      fixture.componentInstance._oneToManyRelation = true;
      fixture.detectChanges();
    });

    it("should pick more than one", () => {
      const button = fixture.debugElement.query(By.css("section button"));
      button.triggerEventHandler("click", undefined);
      fixture.detectChanges();

      const pickButtons = document.querySelectorAll(".mat-mdc-menu-panel mat-table button");
      pickButtons[0].dispatchEvent(new MouseEvent("click"));
      pickButtons[1].dispatchEvent(new MouseEvent("click"));
      fixture.detectChanges();

      const firstRow = fixture.debugElement.query(By.css("section div button"));
      const secondRow = fixture.debugElement.query(By.css("section div button:last-of-type"));

      expect(firstRow.nativeElement.textContent).toBe("anicon Wallet 1 ");
      expect(secondRow.nativeElement.textContent).toBe("anicon Wallet 2 ");
    });

    it("should remove the picked row", () => {
      const button = fixture.debugElement.query(By.css("section button"));
      button.triggerEventHandler("click", undefined);
      fixture.detectChanges();

      const pickButtons = document.querySelectorAll(".mat-mdc-menu-panel mat-cell button");
      pickButtons[0].dispatchEvent(new MouseEvent("click"));
      pickButtons[1].dispatchEvent(new MouseEvent("click"));
      pickButtons[0].dispatchEvent(new MouseEvent("click"));
      fixture.detectChanges();

      const row = fixture.debugElement.query(By.css("section div button"));

      expect(row.nativeElement.textContent).toBe("anicon Wallet 2 ");
    });
  });
});
