import {async, ComponentFixture, TestBed} from "@angular/core/testing";

import {LogViewComponent} from "./log-view.component";

describe("LogViewComponent", () => {
  let component: LogViewComponent;
  let fixture: ComponentFixture<LogViewComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({declarations: [LogViewComponent]}).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(LogViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
