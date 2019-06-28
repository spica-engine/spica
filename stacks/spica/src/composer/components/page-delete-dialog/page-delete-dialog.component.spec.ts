import {async, ComponentFixture, TestBed} from "@angular/core/testing";

import {PageDeleteDialogComponent} from "./page-delete-dialog.component";

describe("PageDeleteDialogComponent", () => {
  let component: PageDeleteDialogComponent;
  let fixture: ComponentFixture<PageDeleteDialogComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({declarations: [PageDeleteDialogComponent]}).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(PageDeleteDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
