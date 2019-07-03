import {async, ComponentFixture, TestBed} from "@angular/core/testing";

import {PropertyLanguageComponent} from "./language.component";

describe("PropertyLanguageComponent", () => {
  let component: PropertyLanguageComponent;
  let fixture: ComponentFixture<PropertyLanguageComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [PropertyLanguageComponent]
    }).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(PropertyLanguageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
