import {async, ComponentFixture, TestBed} from "@angular/core/testing";

import {PolicyIndexComponent} from "./policy-index.component";

describe("PolicyIndexComponent", () => {
  let component: PolicyIndexComponent;
  let fixture: ComponentFixture<PolicyIndexComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({declarations: [PolicyIndexComponent]}).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(PolicyIndexComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
