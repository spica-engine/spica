import {async, ComponentFixture, TestBed} from "@angular/core/testing";

import {IdentityIndexComponent} from "./identity-index.component";

describe("IdentityIndexComponent", () => {
  let component: IdentityIndexComponent;
  let fixture: ComponentFixture<IdentityIndexComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({declarations: [IdentityIndexComponent]}).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(IdentityIndexComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
