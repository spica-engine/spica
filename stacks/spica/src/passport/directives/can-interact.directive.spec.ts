import {Component, ViewChild, DebugElement} from "@angular/core";
import {TestBed, ComponentFixture} from "@angular/core/testing";
import {CanInteractDirective} from "./can-interact.directive";
import {PassportService} from "../services/passport.service";
import {of} from "rxjs";
import {By} from "@angular/platform-browser";

@Component({
  template: `
    <button [canInteract]="action" (click)="onclick()" [resource]="id">Click here.</button>
  `
})
class TestComponent {
  @ViewChild(CanInteractDirective, {static: true}) directive: CanInteractDirective;
  action = "passport:identity:create";
  id = undefined;

  onclick = jasmine.createSpy();
}

class TestPassportService {
  checkAllowed = (value: string) => {
    // custom logic
    if (value.startsWith("bucket")) {
      return of(true);
    }

    return of(false);
  };
}

fdescribe("CanInteract", () => {
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
  });

  fit("should set button disable and show tooltip when hovered", async () => {
    await fixture.whenStable();
    fixture.detectChanges();

    component.onclick.calls.reset();

    // write the right selector.
    const button = undefined;

    console.log(button);

    button.dispatchEvent(new Event("mouseenter"));
    fixture.detectChanges();

    const tooltip = document.querySelector(".ng-tooltip");

    expect(Array.from(tooltip.classList)).toContain("ng-tooltip-show");

    expect(tooltip.textContent).toEqual("passport:identity:create is required for this action.");

    (button as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(component.onclick).toHaveBeenCalledTimes(0);
  });

  it("should not change button's any property", async () => {
    component.onclick.calls.reset();
    component.action = "bucket:create";

    fixture.detectChanges();

    await fixture.whenStable();
    fixture.detectChanges();

    const button: HTMLElement = fixture.debugElement.nativeElement.querySelector("button");

    expect(Array.from(button.classList)).not.toContain("ng-disabled-button");

    (button as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(component.onclick).toHaveBeenCalledTimes(1);
  });
});
