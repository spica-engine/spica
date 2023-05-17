import {ComponentFixture, TestBed} from "@angular/core/testing";

import {ZipViewerComponent} from "./zip-viewer.component";

describe("ZipViewerComponent", () => {
  let component: ZipViewerComponent;
  let fixture: ComponentFixture<ZipViewerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ZipViewerComponent]
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ZipViewerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
