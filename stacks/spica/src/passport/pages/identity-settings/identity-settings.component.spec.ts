import {async, ComponentFixture, TestBed} from "@angular/core/testing";

import {IdentitySettingsComponent} from "./identity-settings.component";

describe("SettingsComponent", () => {
  let component: IdentitySettingsComponent;
  let fixture: ComponentFixture<IdentitySettingsComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({declarations: [IdentitySettingsComponent]}).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(IdentitySettingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
