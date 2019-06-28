import {async, ComponentFixture, TestBed} from "@angular/core/testing";

import {IdentifyComponent} from "./identify.component";

describe("IdentifyComponent", () => {
  let component: IdentifyComponent;
  let fixture: ComponentFixture<IdentifyComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({declarations: [IdentifyComponent]}).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(IdentifyComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
