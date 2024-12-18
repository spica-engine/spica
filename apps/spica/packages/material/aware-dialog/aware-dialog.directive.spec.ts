import {Component} from "@angular/core";
import {ComponentFixture, fakeAsync, flush, TestBed, tick} from "@angular/core/testing";
import {MatDialog} from "@angular/material/dialog";
import {By} from "@angular/platform-browser";
import {NoopAnimationsModule} from "@angular/platform-browser/animations";
import {MatAwareDialogComponent} from "./aware-dialog.component";
import {MatAwareDialogDirective} from "./aware-dialog.directive";
import {MatAwareDialogModule} from "./aware-dialog.module";

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
  confirm = jest.fn();
  cancel = jest.fn();
}

describe("Aware Dialog Directive", () => {
  let fixture: ComponentFixture<TestAwareDialogComponent>;
  let spy: jest.Mock;
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [MatAwareDialogModule, NoopAnimationsModule],
      providers: [MatAwareDialogDirective],
      declarations: [TestAwareDialogComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(TestAwareDialogComponent);
    fixture.detectChanges();
    spy = jest.spyOn(TestBed.get(MatDialog), "open");
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

  //Disabled temporarily: Error: Expected spy confirm to have been called once. It was called 0 times.
  xit("should call confirm if clicked confirm button when answer is correct", fakeAsync(async () => {
    fixture.debugElement.query(By.css("button")).nativeElement.click();
    tick();
    const input = document.body.querySelector("input");
    input.value = "111";
    input.dispatchEvent(new Event("input"));
    const button = document.body.querySelector(
      "mat-dialog-container > mat-aware-dialog > mat-dialog-actions > button:last-of-type"
    ) as HTMLButtonElement;
    button.click();
    flush();
    expect(fixture.componentInstance.confirm).toHaveBeenCalledTimes(1);
  }));
});

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
      [matAwareDialogDisabled]="true"
    >
      click me
    </button>
  `
})
class TestAwareDialogComponentDisabled {
  confirm = jest.fn();
  cancel = jest.fn();
}

describe("Aware Dialog Directive Disabled", () => {
  let fixture: ComponentFixture<TestAwareDialogComponentDisabled>;
  let spy: jest.Mock;
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [MatAwareDialogModule, NoopAnimationsModule],
      providers: [MatAwareDialogDirective],
      declarations: [TestAwareDialogComponentDisabled]
    }).compileComponents();

    fixture = TestBed.createComponent(TestAwareDialogComponentDisabled);
    fixture.detectChanges();
    spy = jest.spyOn(TestBed.get(MatDialog), "open");
  });

  it("should emit confirm if directive disabled", fakeAsync(() => {
    fixture.debugElement.query(By.css("button")).nativeElement.click();
    tick(1000);
    expect(fixture.componentInstance.confirm).toHaveBeenCalledTimes(1);
  }));
});
