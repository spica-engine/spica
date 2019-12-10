import {Component} from "@angular/core";
import {ComponentFixture, TestBed} from "@angular/core/testing";
import {By} from "@angular/platform-browser";
import {PropertyKvPipe} from "./property_keyvalue.pipe";

@Component({
  template: `
    <ul>
      <li *ngFor="let kv of properties | propertyKv">{{ kv.key }}|{{ kv.value }}</li>
    </ul>
  `
})
class PropertyKvTestComponent {
  properties: {[k: string]: string};
}

describe("PropertyKvPipe", () => {
  let fixture: ComponentFixture<PropertyKvTestComponent>;
  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [PropertyKvPipe, PropertyKvTestComponent]
    });
    fixture = TestBed.createComponent(PropertyKvTestComponent);
  });

  it("should return initial value", () => {
    fixture.detectChanges();
    expect(fixture.debugElement.queryAll(By.css("ul > li")).length).toBe(0);

    fixture.componentInstance.properties = {test: "0", test1: "1"};
    fixture.detectChanges();
    expect(
      fixture.debugElement.queryAll(By.css("ul > li")).map(de => de.nativeElement.textContent)
    ).toEqual(["test|0", "test1|1"]);
  });

  it("should keep insertion order", () => {
    fixture.componentInstance.properties = {test1: "1", test: "0"};
    fixture.detectChanges();
    expect(
      fixture.debugElement.queryAll(By.css("ul > li")).map(de => de.nativeElement.textContent)
    ).toEqual(["test1|1", "test|0"]);

    fixture.componentInstance.properties.test3 = "3";
    fixture.componentInstance.properties.test2 = "2";
    fixture.detectChanges();
    expect(
      fixture.debugElement.queryAll(By.css("ul > li")).map(de => de.nativeElement.textContent)
    ).toEqual(["test1|1", "test|0", "test3|3", "test2|2"]);
  });

  it("should sort key order changes", () => {
    fixture.componentInstance.properties = {test: "0", test1: "1"};
    fixture.detectChanges();
    expect(
      fixture.debugElement.queryAll(By.css("ul > li")).map(de => de.nativeElement.textContent)
    ).toEqual(["test|0", "test1|1"]);

    fixture.componentInstance.properties = {test1: "1", test: "0"};
    fixture.detectChanges();
    expect(
      fixture.debugElement.queryAll(By.css("ul > li")).map(de => de.nativeElement.textContent)
    ).toEqual(["test1|1", "test|0"]);
  });
});
