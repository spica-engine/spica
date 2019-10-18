import {Component, ViewChild} from "@angular/core";
import {ComponentFixture, TestBed} from "@angular/core/testing";
import {MatDialogModule} from "@angular/material/dialog";
import {BrowserAnimationsModule} from "@angular/platform-browser/animations";
import {MatAwareDialogDirective} from "./aware-dialog.directive";
import {MatAwareDialogModule} from "./aware-dialog.module";

@Component({
  template: `
    <button
      [matAwareDialog]="{
        title: '111',
        templateOrDescription: '111',
        answer: '111'
      }"
    >
      click me
    </button>
  `
})
class TestAwareDialogComponent {
  @ViewChild(MatAwareDialogDirective, {static: true}) directive: MatAwareDialogDirective;
}

describe("Aware Dialog Directive", () => {
  describe("Directive: Aware Dialog", () => {
    let component: TestAwareDialogComponent;
    let fixture: ComponentFixture<TestAwareDialogComponent>;

    beforeEach(() => {
      TestBed.configureTestingModule({
        declarations: [TestAwareDialogComponent],
        imports: [BrowserAnimationsModule, MatDialogModule, MatAwareDialogModule]
      });
      fixture = TestBed.createComponent(TestAwareDialogComponent);
      component = fixture.componentInstance;
    });

    it("should create component", () => {
      fixture.detectChanges();
      expect(component.directive).toBeDefined();
      expect(component.directive.options).toEqual({
        title: '111',
        templateOrDescription: '111',
        answer: '111'
      });
    });
  });
});
