import {ComponentFixture, TestBed} from "@angular/core/testing";

import {AddBucketComponent} from "./add-bucket.component";

describe("AddBucketComponent", () => {
  let component: AddBucketComponent;
  let fixture: ComponentFixture<AddBucketComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [AddBucketComponent]
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(AddBucketComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
