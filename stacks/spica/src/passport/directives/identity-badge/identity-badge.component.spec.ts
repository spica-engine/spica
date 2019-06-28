import {async, ComponentFixture, TestBed} from "@angular/core/testing";

import {IdentityBadgeComponent} from "./identity-badge.component";

describe("IdentityBadgeComponent", () => {
  let component: IdentityBadgeComponent;
  let fixture: ComponentFixture<IdentityBadgeComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({declarations: [IdentityBadgeComponent]}).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(IdentityBadgeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
