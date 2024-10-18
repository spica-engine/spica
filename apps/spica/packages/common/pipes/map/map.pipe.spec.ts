import {Component} from "@angular/core";
import {ComponentFixture, TestBed} from "@angular/core/testing";
import {By} from "@angular/platform-browser";
import {MapPipe} from "./map.pipe";

@Component({
  template: `
    <div>{{ users | map: "name" | json }}</div>
  `
})
class MapTestComponent {
  users = [
    {_id: "1", name: "Hashim", surname: "Gilliam", age: 26},
    {_id: "2", name: "Adaline", surname: "Coombes", age: 39}
  ];
}

describe("MapPipe", () => {
  let fixture: ComponentFixture<MapTestComponent>;
  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [MapPipe, MapTestComponent]
    });
    fixture = TestBed.createComponent(MapTestComponent);
  });

  it("should map users to their names", () => {
    fixture.detectChanges();
    const templateValue = fixture.debugElement.query(By.css("div")).nativeElement.textContent;
    expect(
      //to make expectation easy to compare
      JSON.parse(templateValue)
    ).toEqual(["Hashim", "Adaline"]);
  });

  it("should work with undefined value", () => {
    fixture.componentInstance.users = undefined;
    fixture.detectChanges();

    const templateValue = fixture.debugElement.query(By.css("div")).nativeElement.textContent;
    expect(templateValue).toEqual("[]");
  });
});
