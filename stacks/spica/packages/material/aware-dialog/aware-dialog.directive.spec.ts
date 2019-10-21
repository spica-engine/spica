import {Component} from "@angular/core";
import {ComponentFixture, TestBed, fakeAsync, tick, flushMicrotasks} from "@angular/core/testing";
import {By} from "@angular/platform-browser";
import {NoopAnimationsModule} from "@angular/platform-browser/animations";
import {MatAwareDialogDirective} from "./aware-dialog.directive";
import {MatAwareDialogModule} from "./aware-dialog.module";
import {MatDialog} from "@angular/material/dialog";
import {MatAwareDialogComponent} from "./aware-dialog.component";

@Component({
  template: `
    <button
      [matAwareDialog]="{
        title: 'asd',
        templateOrDescription: '111',
        answer: '111'
      }"
      (confirm)="confirm($event)"
      (cancel)="cancel($event)"
    >
      click me
    </button>
  `
})
class TestAwareDialogComponent {
  confirm = jasmine.createSpy("confirm");
  cancel = jasmine.createSpy("cancel");
}

describe("Aware Dialog Directive", () => {
  let fixture: ComponentFixture<TestAwareDialogComponent>;
  let spy: jasmine.Spy;
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [MatAwareDialogModule, NoopAnimationsModule],
      providers: [MatAwareDialogDirective],
      declarations: [TestAwareDialogComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(TestAwareDialogComponent);
    fixture.detectChanges();
    spy = spyOn(TestBed.get(MatDialog), "open").and.callThrough();
  });

  it("should create directive", () => {
    const directive = fixture.debugElement.query(By.directive(MatAwareDialogDirective));
    expect(directive).toBeTruthy();
  });

  it("should should call cancel", fakeAsync(() => {
    fixture.debugElement.query(By.css("button")).nativeElement.click();
    expect(spy).toHaveBeenCalledWith(MatAwareDialogComponent, {
      data: {
        title: "asd",
        templateOrDescription: "111",
        answer: "111"
      }
    });
    const button = document.body.querySelector(
      "mat-dialog-container > mat-aware-dialog > mat-dialog-actions > button:first-of-type"
    ) as HTMLButtonElement;
    button.click();
    tick(1000);
    expect(fixture.componentInstance.cancel).toHaveBeenCalledTimes(1);
  }));
  it("should call confirm if clicked confirm button when answer is correct", fakeAsync(() => {
    fixture.debugElement.query(By.css("button")).nativeElement.click();
    tick();
    const input = document.body.querySelector("input");
    input.value = "111";
    input.dispatchEvent(new Event("input"));
    const button = document.body.querySelector(
      "mat-dialog-container > mat-aware-dialog > mat-dialog-actions > button:last-of-type"
    ) as HTMLButtonElement;
    button.click();
    tick(1000);
    expect(fixture.componentInstance.confirm).toHaveBeenCalledTimes(1);
  }));
});
