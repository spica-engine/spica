import {TestBed, ComponentFixture, tick, fakeAsync} from "@angular/core/testing";
import {MatLegacyButtonModule as MatButtonModule} from "@angular/material/legacy-button";
import {ErrorPageComponent} from "./error.page";
import {ActivatedRoute} from "@angular/router";
import {of} from "rxjs";
import {RouterTestingModule} from "@angular/router/testing";
import {Location} from "@angular/common";

describe("Error Page Component", () => {
  let queryParams = {
    queryParams: of({
      status: "Test Status Number",
      statusText: "Test Status Text",
      message: "Test Message"
    })
  };

  let location: Location;
  let fixture: ComponentFixture<ErrorPageComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [ErrorPageComponent],
      imports: [MatButtonModule, RouterTestingModule],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: queryParams
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ErrorPageComponent);
    fixture.detectChanges();
    location = TestBed.get(Location);
  });

  it("should render error page", () => {
    const compiled = fixture.debugElement.nativeElement;
    expect(compiled.querySelector("svg")).toBeDefined();
    expect(compiled.querySelector("span > h2").textContent).toBe("Test Status Number");
    expect(compiled.querySelector("span > h3").textContent).toBe("/ Test Status Text");
    expect(compiled.querySelector("p").textContent).toBe("Test Message");
    expect(compiled.querySelector("button").textContent).toBe(" Take me back to the bright side\n");
  });

  it("should navigate to the source link", fakeAsync(() => {
    const compiled = fixture.debugElement.nativeElement;
    compiled.querySelector("button").click();
    tick();
    fixture.detectChanges();
    expect(location.path()).toEqual("/");
  }));
});
