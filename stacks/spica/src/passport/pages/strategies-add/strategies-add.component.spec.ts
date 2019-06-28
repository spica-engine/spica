import {async, ComponentFixture, TestBed} from "@angular/core/testing";

import {StrategiesAddComponent} from "./strategies-add.component";

describe("StrategiesAddComponent", () => {
  let component: StrategiesAddComponent;
  let fixture: ComponentFixture<StrategiesAddComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [StrategiesAddComponent]
    }).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(StrategiesAddComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
