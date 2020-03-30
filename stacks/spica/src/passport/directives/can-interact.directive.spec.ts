import {Component, ViewChild} from "@angular/core";
import {TestBed, ComponentFixture} from "@angular/core/testing";
import {CanInteractDirective} from "./can-interact.directive";
import {PassportService} from "../services/passport.service";
import {of} from "rxjs";

@Component({
  template: `
    <button [canInteract]="condition">Click here.</button>
  `
})
class TestComponent {
  @ViewChild(CanInteractDirective, {static: true}) directive: CanInteractDirective;
  condition = false;
}

class TestPassportService {
  checkAllowed = (value: boolean) => {
    return of(value);
  };
}

describe("CanInteract", () => {
  let component: TestComponent;
  let fixture: ComponentFixture<TestComponent>;
  let button: HTMLElement;
  let setVisibleSpy: jasmine.Spy;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      declarations: [TestComponent, CanInteractDirective],
      providers: [{provide: PassportService, useClass: TestPassportService}]
    });

    fixture = TestBed.createComponent(TestComponent);
    component = fixture.componentInstance;

    setVisibleSpy = spyOn(component.directive, "setVisible").and.callThrough();

    fixture.detectChanges();

    //wait until initial value set from passport service
    await fixture.whenStable();
    fixture.detectChanges();

    button = fixture.debugElement.nativeElement.querySelector("button");
  });

  it("shouldn't show button if condition is false", () => {
    expect(setVisibleSpy).toHaveBeenCalledTimes(1);
    expect(setVisibleSpy).toHaveBeenCalledWith(false);
    expect(button.style.visibility).toEqual("hidden");
  });

  it("should change visible property of button when condition changed", async () => {
    setVisibleSpy.calls.reset();

    component.condition = true;
    fixture.detectChanges();

    await fixture.whenStable();
    fixture.detectChanges();

    expect(setVisibleSpy).toHaveBeenCalledTimes(1);
    expect(setVisibleSpy).toHaveBeenCalledWith(true);
    expect(button.style.visibility).toEqual("visible");
  });

  it("should not change visiblity if condition's previous and current values are equal", async () => {
    setVisibleSpy.calls.reset();

    component.condition = false;
    fixture.detectChanges();

    await fixture.whenStable();
    fixture.detectChanges();

    expect(setVisibleSpy).toHaveBeenCalledTimes(0);
    expect(button.style.visibility).toEqual("hidden");
  });
});
