import {Component, DebugElement, ViewChild} from "@angular/core";
import {ComponentFixture, TestBed, tick, fakeAsync, async} from "@angular/core/testing";
import {MatClipboardDirective} from "./clipboard.directive";
import {MatClipboardModule} from "./clipboard.module";
import {BrowserAnimationsModule} from "@angular/platform-browser/animations";

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

    let copyButton: HTMLElement;

    beforeEach(() => {
      TestBed.configureTestingModule({
        imports: [MatClipboardModule, BrowserAnimationsModule],
        providers: [],
        declarations: [TestClipBoardComponent]
      });
      fixture = TestBed.createComponent(TestClipBoardComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      copyButton = fixture.debugElement.nativeElement.querySelector("button");
    });

    it("should create component", () => {
      expect(component).toBeDefined();
      expect(component.directive.text).toBe("test");
    });

    it("should change icon as check while copying text", () => {
      copyButton.click();
      fixture.detectChanges();
      expect(copyButton.textContent).toBe("check");
    });

    it("should back to info icon and copied the text ", fakeAsync(async () => {
      copyButton.click();
      tick(1001);
      fixture.detectChanges();
      await fixture.whenStable();
      expect(copyButton.textContent).toBe("info");
    }));

    it("should prepare input element for copying", () => {
      component.directive.prepareClipBoard("test123");
      const inputs = document.getElementsByTagName("input");
      expect([inputs.length, inputs[0].value]).toEqual([1, "test123"]);
      const focusedElement = document.activeElement;
      expect(focusedElement.tagName).toBe("INPUT");
    });
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

      fixture.detectChanges();
    });

    it("should create component", () => {
      expect(component).toBeDefined();
      expect(component.directive.text).toBeUndefined();
    });

    it("should not change icon", () => {
      const copyButton = fixture.debugElement.nativeElement.querySelector("button");
      copyButton.click();
      fixture.detectChanges();
      expect(copyButton.textContent).toBe("info");
    });
  });
});
