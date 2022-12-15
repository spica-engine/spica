import {Component, DebugElement} from "@angular/core";
import {ComponentFixture, TestBed} from "@angular/core/testing";
import {MatSortHeader, MatSortModule} from "@angular/material/sort";
import {MatHeaderCell, MatTableModule} from "@angular/material/table";
import {By} from "@angular/platform-browser";
import {NoopAnimationsModule} from "@angular/platform-browser/animations";
import {MatResizeHeader} from "./resize.directive";

@Component({
  template: `
    <mat-table matSort>
      <ng-container matColumnDef="position">
        <mat-header-cell
          *matHeaderCellDef
          mat-sort-header
          mat-resize-header
          (resize)="positionColumnResize($event)"
          (resizeend)="positionColumnResizeEnd($event)"
        >
          Position
        </mat-header-cell>
      </ng-container>
      <ng-container matColumnDef="weight">
        <!--This is here to test matSort independence-->
        <mat-header-cell *matHeaderCellDef mat-resize-header>
          Weight
        </mat-header-cell>
      </ng-container>
      <mat-header-row *matHeaderRowDef="['position', 'weight']"></mat-header-row>
    </mat-table>
  `
})
class TestComponent {
  positionColumnResize = jasmine.createSpy("positionColumnResize");
  positionColumnResizeEnd = jasmine.createSpy("positionColumnResizeEnd");
}

function getElementScreenXForSize(elem: DebugElement, size: number) {
  const rect = (<HTMLElement>elem.nativeElement).getBoundingClientRect();
  return rect.left + rect.width - size;
}

function hasOriginalClickHandler(elem: DebugElement) {
  const sort = elem.injector.get(MatSortHeader);
  const resize = elem.injector.get(MatResizeHeader);
  return resize["_originalHandleClick"] == sort["_handleClick"];
}

describe("MatResize", () => {
  let fixture: ComponentFixture<TestComponent>;
  let columnHeaders: DebugElement[];

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [MatTableModule, MatSortModule, NoopAnimationsModule],
      declarations: [TestComponent, MatResizeHeader]
    });
    fixture = TestBed.createComponent(TestComponent);
    fixture.detectChanges();
    columnHeaders = fixture.debugElement.queryAll(By.directive(MatHeaderCell));
  });

  it("should set initial width of element", async () => {
    await fixture.whenStable();
    fixture.detectChanges();

    const [positionColumnHeader] = columnHeaders;
    positionColumnHeader.triggerEventHandler("mouseup", {});

    fixture.detectChanges();

    expect(fixture.componentInstance.positionColumnResizeEnd).toHaveBeenCalledTimes(1);
    expect(fixture.componentInstance.positionColumnResizeEnd).toHaveBeenCalledWith(
      parseInt(positionColumnHeader.styles.width)
    );
  });

  it("should disable sort when mouseover and re-enable when the mouse move away", () => {
    const [positionColumnHeader] = columnHeaders;

    positionColumnHeader.triggerEventHandler("mousemove", {
      pageX: getElementScreenXForSize(positionColumnHeader, 90)
    });
    fixture.detectChanges();
    expect(hasOriginalClickHandler(positionColumnHeader)).toBe(false);

    positionColumnHeader.triggerEventHandler("mousemove", {
      pageX: getElementScreenXForSize(positionColumnHeader, 120)
    });
    fixture.detectChanges();
    expect(hasOriginalClickHandler(positionColumnHeader)).toBe(true);
  });

  it("should resize and call resizeend only if when the width has been changed", () => {
    const [positionColumnHeader] = columnHeaders;
    const borderPosition = getElementScreenXForSize(positionColumnHeader, 0);
    const initalWidth = positionColumnHeader.nativeElement.clientWidth;

    positionColumnHeader.triggerEventHandler("mousedown", {
      target: positionColumnHeader.nativeElement,
      screenX: borderPosition - 50
    });
    positionColumnHeader.triggerEventHandler("mousemove", {screenX: borderPosition - 50});

    expect(positionColumnHeader.nativeElement.clientWidth).toBe(initalWidth);
    expect(fixture.componentInstance.positionColumnResize).not.toHaveBeenCalled();
    expect(fixture.componentInstance.positionColumnResizeEnd).not.toHaveBeenCalled();
  });
});
