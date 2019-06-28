import {async, ComponentFixture, TestBed} from "@angular/core/testing";

import {IdentityAddComponent} from "./identity-add.component";

describe("IdentityAddComponent", () => {
  let component: IdentityAddComponent;
  let fixture: ComponentFixture<IdentityAddComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({declarations: [IdentityAddComponent]}).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(IdentityAddComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
