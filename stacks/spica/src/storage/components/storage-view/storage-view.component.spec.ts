import {async, ComponentFixture, TestBed} from "@angular/core/testing";

import {StorageViewComponent} from "./storage-view.component";

describe("SecuredStorageComponent", () => {
  let component: StorageViewComponent;
  let fixture: ComponentFixture<StorageViewComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({declarations: [StorageViewComponent]}).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(StorageViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
