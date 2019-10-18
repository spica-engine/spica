import {Component, DebugElement, ViewChild} from "@angular/core";
import {ComponentFixture, TestBed} from "@angular/core/testing";
import {MatClipboardDirective} from "./clipboard.directive";
import {By} from "@angular/platform-browser";
import {MatClipboardModule} from "./clipboard.module";

//UNDONE

@Component({
  template: `
    <button #clipboard="matClipboard" [matClipboard]="test">Copy Me!</button>
  `
})
class TestClipBoardComponent {
  @ViewChild(MatClipboardDirective, {static: true}) directive: MatClipboardDirective;
}

describe("ClipboardDirective", () => {
  let component: TestClipBoardComponent;
  let fixture: ComponentFixture<TestClipBoardComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [MatClipboardModule],
      providers: [],
      declarations: [TestClipBoardComponent]
    });
    fixture = TestBed.createComponent(TestClipBoardComponent);
    component = fixture.componentInstance;
  });

  it("should create component", () => {
    expect(component).toBeDefined();
  });
});
