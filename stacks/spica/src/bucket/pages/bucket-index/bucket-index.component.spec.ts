import {async, ComponentFixture, TestBed} from "@angular/core/testing";

import {BucketIndexComponent} from "./bucket-index.component";

describe("BucketIndexComponent", () => {
  let component: BucketIndexComponent;
  let fixture: ComponentFixture<BucketIndexComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({declarations: [BucketIndexComponent]}).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(BucketIndexComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
