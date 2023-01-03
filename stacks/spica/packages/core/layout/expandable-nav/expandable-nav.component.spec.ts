import {ComponentFixture, TestBed} from "@angular/core/testing";

import {ExpandableNavComponent} from "./expandable-nav.component";

describe("ExpandableNavComponent", () => {
  let component: ExpandableNavComponent;
  let fixture: ComponentFixture<ExpandableNavComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ExpandableNavComponent]
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ExpandableNavComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
