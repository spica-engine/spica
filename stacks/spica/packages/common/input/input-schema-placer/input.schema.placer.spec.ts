import {TestBed, ComponentFixture, fakeAsync, tick, async} from "@angular/core/testing";
import {InputSchemaPlacer} from "./input.schema.placer";
import {InputResolver} from "../input.resolver";
import {InputModule} from "../input.module";
import {BrowserAnimationsModule} from "@angular/platform-browser/animations";
import {MatFormFieldModule, MatSelectModule} from "@angular/material";

//check testbed testmodule

xdescribe("Input Schema Placer", () => {
  let component: InputSchemaPlacer;
  let fixture: ComponentFixture<InputSchemaPlacer>;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [InputModule, BrowserAnimationsModule, MatFormFieldModule, MatSelectModule],
      providers: [],
      declarations: []
    });

    fixture = TestBed.createComponent(InputSchemaPlacer);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it("should work", async () => {
    expect(component).toBeDefined();
  });
});
