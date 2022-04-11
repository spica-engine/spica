import {ComponentFixture, TestBed} from "@angular/core/testing";

import {VersioncontrolComponent} from "./versioncontrol.component";

describe("VersioncontrolComponent", () => {
  let component: VersioncontrolComponent;
  let fixture: ComponentFixture<VersioncontrolComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [VersioncontrolComponent]
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(VersioncontrolComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
