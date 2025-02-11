import {Component, DebugElement, ViewChild} from "@angular/core";
import {ComponentFixture, TestBed} from "@angular/core/testing";
import {MatHeaderCell, MatTableModule} from "@angular/material/table";
import {By} from "@angular/platform-browser";
import {PersistHeaderWidthDirective} from "./persist-header-width.directive";

@Component({
  template: `
    <mat-table>
      <ng-container matColumnDef="position">
        <mat-header-cell *matHeaderCellDef [persist-header-width]="bucketId">
          Position
        </mat-header-cell>
      </ng-container>
      <mat-header-row *matHeaderRowDef="['position']"></mat-header-row>
    </mat-table>
  `
})
class TestComponent {
  bucketId: string = "test";
  @ViewChild(PersistHeaderWidthDirective) directive: PersistHeaderWidthDirective;
}

describe("PersistHeaderWidth", () => {
  let fixture: ComponentFixture<TestComponent>;
  let columnHeader: DebugElement;

  function getPersistedWidth(): number {
    return Number(localStorage.getItem("test-position"));
  }

  function setPersistedWidth(val: number) {
    return localStorage.setItem("test-position", String(val));
  }

  function unsetPersistedWidth(): void {
    localStorage.removeItem("test-position");
  }

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [MatTableModule],
      declarations: [TestComponent, PersistHeaderWidthDirective]
    });
    fixture = TestBed.createComponent(TestComponent);
    fixture.detectChanges();
    columnHeader = fixture.debugElement.query(By.directive(MatHeaderCell));
  });

  afterEach(() => unsetPersistedWidth());

  it("should not change the width", () => {
    expect(columnHeader.styles.width).toBeFalsy();
  });

  it("should change the columns width to persisted value", () => {
    let resizeSpy = spyOn(fixture.componentInstance.directive._resize, "emit");
    fixture.componentInstance.bucketId = undefined;
    fixture.detectChanges();
    setPersistedWidth(100);
    fixture.componentInstance.bucketId = "test";
    fixture.detectChanges();
    expect(resizeSpy).toHaveBeenCalledTimes(1);
    expect(resizeSpy).toHaveBeenCalledWith(100);
  });

  it("should persist the width when the column resizes", () => {
    columnHeader.triggerEventHandler("resizeend", 200);
    fixture.detectChanges();
    expect(getPersistedWidth()).toBe(200);
  });
});
