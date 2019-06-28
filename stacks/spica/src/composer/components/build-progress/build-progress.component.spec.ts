import {async, ComponentFixture, TestBed} from "@angular/core/testing";

import {BuildProgressComponent} from "./build-progress.component";

describe("BuildProgressComponent", () => {
  let component: BuildProgressComponent;
  let fixture: ComponentFixture<BuildProgressComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({declarations: [BuildProgressComponent]}).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(BuildProgressComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
