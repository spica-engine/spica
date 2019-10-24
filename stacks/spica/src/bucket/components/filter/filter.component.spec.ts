import {ComponentFixture, TestBed} from "@angular/core/testing";
import {MatSelectModule} from "@angular/material/select";
import {FilterComponent} from "./filter.component";
import {FormsModule} from "@angular/forms";
import {InputModule} from "../../../../packages/common/input/input.module";
import {NoopAnimationsModule} from "@angular/platform-browser/animations";

describe("FilterComponent", () => {
  let component: FilterComponent;
  let fixture: ComponentFixture<FilterComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [FormsModule, MatSelectModule, InputModule, NoopAnimationsModule],
      providers: [],
      declarations: [FilterComponent]
    }).compileComponents();
    fixture = TestBed.createComponent(FilterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
