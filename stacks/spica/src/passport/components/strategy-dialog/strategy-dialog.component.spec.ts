import {async, ComponentFixture, TestBed} from "@angular/core/testing";

import {StrategyDialogComponent} from "./strategy-dialog.component";

describe("StrategyDialogComponent", () => {
  let component: StrategyDialogComponent;
  let fixture: ComponentFixture<StrategyDialogComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [StrategyDialogComponent]
    }).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(StrategyDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
