import {async, ComponentFixture, TestBed} from "@angular/core/testing";

import {StrategiesComponent} from "./strategies.component";

describe("StrategiesComponent", () => {
  let component: StrategiesComponent;
  let fixture: ComponentFixture<StrategiesComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [StrategiesComponent]
    }).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(StrategiesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
