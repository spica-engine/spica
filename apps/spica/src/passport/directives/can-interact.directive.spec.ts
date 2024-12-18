import {Component, ViewChild} from "@angular/core";
import {TestBed, ComponentFixture} from "@angular/core/testing";
import {CanInteractDirective} from "./can-interact.directive";
import {PassportService} from "../services/passport.service";
import {of} from "rxjs";

@Component({
  template: `
    <button [canInteract]="action" (click)="onclick()" [resource]="id">
      Click here.
    </button>
  `
})
class TestComponent {
  @ViewChild(CanInteractDirective, {static: true}) directive: CanInteractDirective;
  action = "passport:identity:create";
  id = undefined;

  onclick = jest.fn();
}

class TestPassportService {
  checkAllowed = (action: string) => {
    // custom logic
    if (action == "bucket:create") {
      return of(true);
    }

    return of(false);
  };
}

describe("CanInteract", () => {
  let component: TestComponent;
  let fixture: ComponentFixture<TestComponent>;
  beforeEach(async () => {
    TestBed.configureTestingModule({
      declarations: [TestComponent, CanInteractDirective],
      providers: [{provide: PassportService, useClass: TestPassportService}]
    });

    fixture = TestBed.createComponent(TestComponent);
    component = fixture.componentInstance;

    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => {
    component.onclick.mockReset();
  });

  it("should set button disable and show tooltip when hovered", () => {
    const actualButtons = document.body.querySelector("button");

    expect(actualButtons.style.display).toEqual("none");

    const disabledButtons = document.body.querySelectorAll("button.ng-disabled-button");

    expect(disabledButtons.length).toEqual(1);

    disabledButtons[0].dispatchEvent(new Event("mouseenter"));
    fixture.detectChanges();

    const tooltips = document.querySelectorAll(".ng-tooltip-show");

    expect(tooltips.length).toEqual(1);
    expect(tooltips[0].textContent).toEqual(
      "passport:identity:create is required for this action."
    );

    (disabledButtons[0] as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(component.onclick).toHaveBeenCalledTimes(0);
  });

  it("should revert actual button", async () => {
    component.action = "bucket:create";

    fixture.detectChanges();
    await fixture.whenStable();

    const actualButton: HTMLElement = fixture.debugElement.nativeElement.querySelector("button");

    (actualButton as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(component.onclick).toHaveBeenCalledTimes(1);

    const disabledButton = fixture.debugElement.nativeElement.querySelector(
      "button.ng-disabled-button"
    );

    expect(disabledButton).toBeNull();
  });

  it("should not add one more disabled button if already exist, but update tooltip message", async () => {
    component.action = "passport:identity:update";

    fixture.detectChanges();
    await fixture.whenStable();

    const disabledButtons = document.body.querySelectorAll("button.ng-disabled-button");

    expect(disabledButtons.length).toEqual(1);

    disabledButtons[0].dispatchEvent(new Event("mouseenter"));
    fixture.detectChanges();

    const tooltips = document.querySelectorAll(".ng-tooltip-show");

    expect(tooltips.length).toEqual(1);

    expect(tooltips[0].textContent).toEqual(
      "passport:identity:update is required for this action."
    );
  });
});
