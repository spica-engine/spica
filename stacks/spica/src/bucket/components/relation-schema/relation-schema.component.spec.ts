import {async, ComponentFixture, TestBed} from "@angular/core/testing";

import {RelationSchemaComponent} from "./relation-schema.component";

describe("RelationSchemaComponent", () => {
  let component: RelationSchemaComponent;
  let fixture: ComponentFixture<RelationSchemaComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({declarations: [RelationSchemaComponent]}).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(RelationSchemaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
