import {Component, ViewChild} from "@angular/core";
import {ComponentFixture, fakeAsync, TestBed, tick} from "@angular/core/testing";
import {By} from "@angular/platform-browser";
import {of} from "rxjs";
import {MatSaveDirective} from "./save.directive";
import {MatSaveModule} from "./save.module";
import {SavingState} from "./interface";

@Component({
  template: `
    <button *matSave="$save | async; let state">{{ state }}</button>
  `
})
class TestSaveComponent {
  @ViewChild(MatSaveDirective, {static: true}) directive: MatSaveDirective;
  $save = of("");
}

describe("SaveDirective", () => {
  let component: TestSaveComponent;
  let fixture: ComponentFixture<TestSaveComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [MatSaveModule],
      providers: [],
      declarations: [TestSaveComponent]
    });
    fixture = TestBed.createComponent(TestSaveComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create component", () => {
    expect(component).toBeDefined();
    expect(component.directive["_context"].$implicit).toEqual(SavingState.Pristine);
    expect(component.directive["_context"].state).toEqual(SavingState.Pristine);
  });

  it("should change button text when when observable changed as Saving state", () => {
    fixture.componentInstance.$save = of(SavingState.Saving);
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.css("button")).nativeElement.textContent).toEqual(
      "saving"
    );
  });

  it("should change button text and revert back to Pristine after 1 sec when observable changed as Saved state", fakeAsync(() => {
    fixture.componentInstance.$save = of(SavingState.Saving);
    fixture.componentInstance.$save = of(SavingState.Saved);
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.css("button")).nativeElement.textContent).toEqual("saved");
    expect(fixture.componentInstance.directive["_timeout"]).toBeDefined();
    tick(1000);
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.css("button")).nativeElement.textContent).toEqual("");
  }));

  it("should clear timeout and shouldn't revert back to Pristine", fakeAsync(() => {
    fixture.componentInstance.$save = of(SavingState.Saved);
    fixture.detectChanges();
    expect(fixture.componentInstance.directive["_timeout"]).toBeDefined();
    fixture.componentInstance.$save = of(SavingState.Saving);
    tick(1500);
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.css("button")).nativeElement.textContent).toEqual(
      "saving"
    );
  }));
});
