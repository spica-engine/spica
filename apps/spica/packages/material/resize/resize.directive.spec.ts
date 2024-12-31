import {Component, DebugElement} from "@angular/core";
import {ComponentFixture, TestBed} from "@angular/core/testing";
import {MatSortHeader, MatSortModule} from "@angular/material/sort";
import {MatLegacyHeaderCell as MatHeaderCell, MatLegacyTableModule as MatTableModule} from "@angular/material/legacy-table";
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
      <ng-container matColumnDef="height">
        <mat-header-cell
          *matHeaderCellDef
          mat-sort-header
          mat-resize-header
          (resize)="positionColumnResize($event)"
          (resizeend)="positionColumnResizeEnd($event)"
        >
          Height
        </mat-header-cell>
      </ng-container>
      <mat-header-row *matHeaderRowDef="['position', 'weight', 'height']"></mat-header-row>
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
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it("should set initial width of element", async () => {
    const [positionColumnHeader] = columnHeaders;
    positionColumnHeader.triggerEventHandler("mouseup", {});

    fixture.detectChanges();

    expect(fixture.componentInstance.positionColumnResizeEnd).toHaveBeenCalledTimes(1);
    expect(fixture.componentInstance.positionColumnResizeEnd).toHaveBeenCalledWith(
      parseInt(positionColumnHeader.styles.width)
    );
  });

  it("should add the size as a padding from right", () => {
    const [positionColumnHeader, weightColumnHeader] = columnHeaders;
    expect(positionColumnHeader.styles["padding-right"]).toBe("100px");
    expect(weightColumnHeader.styles["padding-right"]).toBe("100px");
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

  xit("should resize and invoke resize and resizeend events", async () => {
    const [positionColumnHeader] = columnHeaders;
    const borderPosition = getElementScreenXForSize(positionColumnHeader, 0);
    const initalWidth = positionColumnHeader.nativeElement.clientWidth;

    positionColumnHeader.triggerEventHandler("mousedown", {
      target: positionColumnHeader.nativeElement,
      pageX: borderPosition - 50
    });
    positionColumnHeader.triggerEventHandler("mousemove", {pageX: borderPosition + 100});
    positionColumnHeader.triggerEventHandler("mouseup", {});
    fixture.detectChanges();

    const desiredWidth = initalWidth + 150;

    expect(positionColumnHeader.styles.width).toBe(`${desiredWidth}px`);
    expect(fixture.componentInstance.positionColumnResize).toHaveBeenCalledTimes(1);
    expect(fixture.componentInstance.positionColumnResize).toHaveBeenCalledWith(desiredWidth);

    expect(fixture.componentInstance.positionColumnResizeEnd).toHaveBeenCalledTimes(1);
    expect(fixture.componentInstance.positionColumnResizeEnd).toHaveBeenCalledWith(desiredWidth);

    expect(fixture.componentInstance.positionColumnResize).toHaveBeenCalledBefore(
      fixture.componentInstance.positionColumnResizeEnd
    );
  });
});
