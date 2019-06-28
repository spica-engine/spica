import {async, ComponentFixture, TestBed} from "@angular/core/testing";

import {BucketAddComponent} from "./bucket-add.component";

describe("BucketAddComponent", () => {
  let component: BucketAddComponent;
  let fixture: ComponentFixture<BucketAddComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [BucketAddComponent]
    }).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(BucketAddComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
