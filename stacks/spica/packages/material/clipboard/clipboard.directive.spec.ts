import {Component, ViewChild} from "@angular/core";
import {ComponentFixture, TestBed} from "@angular/core/testing";
import {By} from "@angular/platform-browser";
import {MatClipboardDirective} from "./clipboard.directive";

describe("ClipboardDirective", () => {
  let fixture: ComponentFixture<TestComponent>;

  @Component({
    template: `
      text: string = "text";
      <button #clipboard="matClipboard" [matClipboard]="text">{{ clipboard.icon }}</button>
    `
  })
  class TestComponent {
    @ViewChild(MatClipboardDirective, {static: true}) clipboard: MatClipboardDirective;
    text: string = "text";
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [TestComponent, MatClipboardDirective]
    });

    fixture = TestBed.createComponent(TestComponent);
  });

  it("should find clipboard directive", () => {
    expect(fixture.componentInstance.clipboard).toBeTruthy();
  });

  it("should change the icon", done => {
    const button = fixture.debugElement.query(By.css("button")).nativeElement as HTMLButtonElement;
    fixture.detectChanges();
    expect(button.textContent).toBe("info");
    button.click();
    fixture.detectChanges();
    expect(button.textContent).toBe("check");
    setTimeout(() => {
      fixture.detectChanges();
      expect(button.textContent).toBe("info");
      done();
    }, 1001);
  });
});
