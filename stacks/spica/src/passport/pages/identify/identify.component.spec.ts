import {HttpClientTestingModule} from "@angular/common/http/testing";
import {ComponentFixture, fakeAsync, TestBed, tick} from "@angular/core/testing";
import {FormsModule, NgForm, NgModel} from "@angular/forms";
import {MatCardModule} from "@angular/material/card";
import {MatDialogModule} from "@angular/material/dialog";
import {MatFormFieldModule} from "@angular/material/form-field";
import {MatIconModule} from "@angular/material/icon";
import {MatInputModule} from "@angular/material/input";
import {MatTooltipModule} from "@angular/material/tooltip";
import {By} from "@angular/platform-browser";
import {NoopAnimationsModule} from "@angular/platform-browser/animations";
import {ActivatedRoute} from "@angular/router";
import {RouterTestingModule} from "@angular/router/testing";
import {of, Subject, throwError} from "rxjs";
import {IdentifyComponent} from "./identify.component";

describe("Identify Component", () => {
  let fixture: ComponentFixture<IdentifyComponent>;
  let routerSpy;
  let identifyWithSpy: jasmine.Spy<typeof fixture.componentInstance.passport.identifyWith>;

  const strategies = [
    {
      icon: "icon",
      name: "name",
      title: "title",
      type: "type"
    },
    {
      icon: "icon2",
      name: "name2",
      title: "title2",
      type: "type2"
    }
  ];

  let activatedRoute: {
    queryParams: Subject<any>;
  };

  beforeEach(() => {
    activatedRoute = {
      queryParams: new Subject()
    };

    TestBed.configureTestingModule({
      imports: [
        RouterTestingModule.withRoutes([]),
        FormsModule,
        MatFormFieldModule,
        MatIconModule,
        MatCardModule,
        MatTooltipModule,
        MatDialogModule,
        MatInputModule,
        HttpClientTestingModule,
        NoopAnimationsModule
      ],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: activatedRoute
        }
      ],
      declarations: [IdentifyComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(IdentifyComponent);

    spyOn(fixture.componentInstance.passport, "getStrategies").and.returnValue(of(strategies));
    identifyWithSpy = spyOn(fixture.componentInstance.passport, "identifyWith").and.callFake(
      (name: string) => {
        return name == "name2" ? throwError({error: {message: "Here is the error."}}) : of(null);
      }
    );
    spyOn(fixture.componentInstance.passport, "identify").and.returnValue(of({}));

    routerSpy = spyOn(fixture.componentInstance.router, "navigate");
    fixture.detectChanges();
  });

  describe("login", () => {
    it("should login if user has been identified already", () => {
      spyOnProperty(fixture.componentInstance.passport, "identified", "get").and.returnValue(true);

      activatedRoute.queryParams.next({});

      expect(routerSpy).toHaveBeenCalledTimes(1);
      expect(routerSpy).toHaveBeenCalledWith([""]);
    });

    it("should not login if user has not been identified and there is no provided token", () => {
      spyOnProperty(fixture.componentInstance.passport, "identified", "get").and.returnValue(false);

      activatedRoute.queryParams.next({});

      expect(routerSpy).not.toHaveBeenCalled();
    });

    it("should set token but should not navigate to the home page if it's not valid", () => {
      spyOnProperty(fixture.componentInstance.passport, "identified", "get").and.returnValue(false);

      activatedRoute.queryParams.next({token: "TEST_TOKEN"});

      expect(fixture.componentInstance.passport.token).toEqual("TEST_TOKEN");

      expect(routerSpy).not.toHaveBeenCalled();
    });

    it("should set token and navigate to the home page if it's valid", () => {
      spyOnProperty(fixture.componentInstance.passport, "identified", "get").and.returnValue(true);

      activatedRoute.queryParams.next({token: "TEST_TOKEN"});

      expect(fixture.componentInstance.passport.token).toEqual("TEST_TOKEN");

      expect(routerSpy).toHaveBeenCalledTimes(1);
      expect(routerSpy).toHaveBeenCalledWith([""]);
    });
  });

  describe("basic behaviours", () => {
    it("should render when component created", async () => {
      const [identifierModel, passwordModel] = fixture.debugElement
        .queryAll(By.directive(NgModel))
        .map(m => m.injector.get(NgModel));

      expect(identifierModel.model).toBe(undefined);
      expect(passwordModel.model).toBe(undefined);

      expect(
        fixture.debugElement.query(By.css("mat-card-actions button:nth-child(1)")).nativeElement
          .textContent
      ).toBe("icon title ");

      expect(
        fixture.debugElement.query(By.css("mat-card-actions button:nth-child(2)")).nativeElement
          .textContent
      ).toBe("icon2 title2 ");

      await fixture.whenStable();
      fixture.detectChanges();

      expect(
        fixture.debugElement.query(By.css("mat-card-actions button:last-of-type")).nativeElement
          .disabled
      ).toBe(true);
    });
  });

  describe("actions", () => {
    beforeEach(() => {
      routerSpy.calls.reset();
    });
    it("should identify successfully when clicked first strategy", fakeAsync(() => {
      fixture.debugElement
        .query(By.css("mat-card-actions button:nth-child(1)"))
        .nativeElement.click();

      tick();
      fixture.detectChanges();

      expect(routerSpy).toHaveBeenCalledTimes(1);
      expect(routerSpy).toHaveBeenCalledWith(["/dashboard"]);
    }));

    it("should identify successfully when clicked login button after filled form", fakeAsync(async () => {
      await fixture.whenStable();
      fixture.debugElement
        .query(By.css("form"))
        .injector.get(NgForm)
        .setValue({
          identifier: "identifier",
          password: "password"
        });
      await fixture.debugElement
        .queryAll(By.css("mat-card-actions button"))[2]
        .nativeElement.click();

      expect(fixture.componentInstance.identity).toEqual({
        identifier: "identifier",
        password: "password"
      });
      expect(routerSpy).toHaveBeenCalledTimes(1);
      expect(routerSpy).toHaveBeenCalledWith(["/dashboard"]);
    }));
  });

  describe("errors", () => {
    beforeEach(() => {
      routerSpy.calls.reset();
    });
    it("should show error", fakeAsync(() => {
      fixture.debugElement
        .query(By.css("mat-card-actions button:nth-child(2)"))
        .nativeElement.click();
      tick();
      fixture.detectChanges();
      expect(fixture.debugElement.query(By.css("form mat-error")).nativeElement.textContent).toBe(
        "Here is the error."
      );
      expect(routerSpy).toHaveBeenCalledTimes(0);
    }));
  });

  describe("strategy", () => {
    it("should initiate login via strategy in a modal", fakeAsync(() => {
      activatedRoute.queryParams.next({strategy: "name"});
      tick();
      expect(identifyWithSpy).toHaveBeenCalled();
      expect(identifyWithSpy.calls.mostRecent().args[0]).toBe("name");
      expect(typeof identifyWithSpy.calls.mostRecent().args[1]).toBe("function");
    }));
  });
});
