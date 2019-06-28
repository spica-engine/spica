import {async, ComponentFixture, TestBed} from "@angular/core/testing";

import {PolicyAddComponent} from "./policy-add.component";

describe("PolicyAddComponent", () => {
  let component: PolicyAddComponent;
  let fixture: ComponentFixture<PolicyAddComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({declarations: [PolicyAddComponent]}).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(PolicyAddComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
