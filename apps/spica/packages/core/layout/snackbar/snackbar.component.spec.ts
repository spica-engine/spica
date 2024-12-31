import {ComponentFixture, TestBed, waitForAsync} from "@angular/core/testing";

import {SnackbarComponent} from "./snackbar.component";
import {MatLegacySnackBar as MatSnackBar, MatLegacySnackBarModule as MatSnackBarModule} from "@angular/material/legacy-snack-bar";
import {SnackbarError} from "./interface";
import {Component, NgModule} from "@angular/core";
import {NoopAnimationsModule} from "@angular/platform-browser/animations";

@Component({
  template: ``
})
class TestComponent {
  constructor(private snackBar: MatSnackBar) {}
  open() {
    this.snackBar.openFromComponent(SnackbarComponent, {
      data: {
        status: 404,
        message: "Couldn't find."
      } as SnackbarError,
      duration: 3000
    });
  }
}

@NgModule({
  declarations: [TestComponent, SnackbarComponent]
})
class TestModule {}

describe("SnackbarComponent", () => {
  let component: TestComponent;
  let fixture: ComponentFixture<TestComponent>;

  beforeEach(
    waitForAsync(() => {
      TestBed.configureTestingModule({
        imports: [TestModule, MatSnackBarModule, NoopAnimationsModule]
      }).compileComponents();

      fixture = TestBed.createComponent(TestComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();
    })
  );

  it("should render component with given data", () => {
    fixture.componentInstance.open();

    const lines = document.body.querySelectorAll("snackbar > div");

    expect(lines[0].textContent).toEqual("Code: 404");
    expect(lines[1].textContent).toEqual("Couldn't find.");
  });

  it("should close component", async () => {
    fixture.componentInstance.open();

    const container = document.body.querySelector("snackbar");
    (container as HTMLElement).click();

    fixture.detectChanges();
    await fixture.whenStable();

    expect(document.body.querySelector("snackbar")).toBe(null);
  });
});
