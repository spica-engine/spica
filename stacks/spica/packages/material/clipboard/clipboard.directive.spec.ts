import {Component, DebugElement, ViewChild} from "@angular/core";
import {ComponentFixture, TestBed, tick, fakeAsync, async} from "@angular/core/testing";
import {MatClipboardDirective} from "./clipboard.directive";
import {By} from "@angular/platform-browser";
import {MatClipboardModule} from "./clipboard.module";
import {BrowserAnimationsModule} from "@angular/platform-browser/animations";

//UNDONE

@Component({
  template: `
    <button #clipboard="matClipboard" [matClipboard]="'test'">{{ clipboard.icon }}</button>
  `
})
class TestClipBoardComponent {
  @ViewChild(MatClipboardDirective, {static: true}) directive: MatClipboardDirective;
}

@Component({
  template: `
    <button #clipboard="matClipboard" [matClipboard]>{{ clipboard.icon }}</button>
  `
})
class TestClipBoardComponentNull {
  @ViewChild(MatClipboardDirective, {static: true}) directive: MatClipboardDirective;
}

describe("ClipboardDirective", () => {
  describe("test for defined text", () => {
    let component: TestClipBoardComponent;
    let fixture: ComponentFixture<TestClipBoardComponent>;

    beforeEach(() => {
      TestBed.configureTestingModule({
        imports: [MatClipboardModule, BrowserAnimationsModule],
        providers: [],
        declarations: [TestClipBoardComponent]
      });
      fixture = TestBed.createComponent(TestClipBoardComponent);
      component = fixture.componentInstance;
    });

    it("should create component", () => {
      fixture.detectChanges();
      expect(component).toBeDefined();
      expect(component.directive.text).toBe("test");
    });

    it("should change icon as check while copying text", () => {
      fixture.detectChanges();
      const button = fixture.debugElement.nativeElement.querySelector("button");
      button.click();
      fixture.detectChanges();
      expect(button.textContent).toBe("check");
    });

    it("should back to info icon and copied the text ", fakeAsync(async () => {
      fixture.detectChanges();
      const button = fixture.debugElement.nativeElement.querySelector("button");
      button.click();
      tick(1001);
      fixture.detectChanges();
      await fixture.whenStable();
      expect(button.textContent).toBe("info");
    }));
  });

  describe("test for undefined text", () => {
    let component: TestClipBoardComponent;
    let fixture: ComponentFixture<TestClipBoardComponent>;

    beforeEach(() => {
      TestBed.configureTestingModule({
        imports: [MatClipboardModule, BrowserAnimationsModule],
        providers: [],
        declarations: [TestClipBoardComponentNull]
      });
      fixture = TestBed.createComponent(TestClipBoardComponentNull);
      component = fixture.componentInstance;
    });

    it("should create component", () => {
      fixture.detectChanges();
      expect(component).toBeDefined();
      expect(component.directive.text).toBeUndefined();
    });

    it("should not change icon", () => {
      fixture.detectChanges();
      const button = fixture.debugElement.nativeElement.querySelector("button");
      button.click();
      fixture.detectChanges();
      expect(button.textContent).toBe("info");
    });
  });
});
