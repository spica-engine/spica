import {async, ComponentFixture, TestBed} from "@angular/core/testing";

import {RelationComponent} from "./relation.component";

describe("RelationComponent", () => {
  let component: RelationComponent;
  let fixture: ComponentFixture<RelationComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({declarations: [RelationComponent]}).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(RelationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
