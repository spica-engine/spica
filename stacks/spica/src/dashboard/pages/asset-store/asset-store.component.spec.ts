import {ComponentFixture, TestBed} from "@angular/core/testing";

import {AssetStoreComponent} from "./asset-store.component";

describe("AssetStoreComponent", () => {
  let component: AssetStoreComponent;
  let fixture: ComponentFixture<AssetStoreComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [AssetStoreComponent]
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(AssetStoreComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
