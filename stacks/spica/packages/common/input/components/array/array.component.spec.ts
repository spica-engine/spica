import {TestBed, ComponentFixture, fakeAsync, tick, async} from "@angular/core/testing";
import {ArrayComponent} from "./array.component";
import {MatCardModule, MatButtonModule, MatIconModule} from "@angular/material";
import {DragDropModule} from "@angular/cdk/drag-drop";

xdescribe("Array Component", () => {
  let component: ArrayComponent;
  let fixture: ComponentFixture<ArrayComponent>;
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [MatCardModule, DragDropModule, MatIconModule, MatButtonModule],
      providers: [],
      declarations: [ArrayComponent]
    });
    fixture = TestBed.createComponent(ArrayComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should work", () => {
    expect(component).toBeTruthy();
  });
});
