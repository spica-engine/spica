import {ComponentFixture, TestBed, fakeAsync, tick, flushMicrotasks} from "@angular/core/testing";
import {IdentifyComponent} from "./identify.component";
import {MatFormFieldModule} from "@angular/material/form-field";
import {FormsModule, NgModel, NgForm} from "@angular/forms";
import {MatIconModule} from "@angular/material/icon";
import {MatCardModule} from "@angular/material/card";
import {MatTooltipModule} from "@angular/material/tooltip";
import {PassportService, IdentifyParams} from "../../services/passport.service";
import {RouterModule} from "@angular/router";
import {of, throwError} from "rxjs";
import {MatInputModule} from "@angular/material";
import {NoopAnimationsModule} from "@angular/platform-browser/animations";
import {By} from "@angular/platform-browser";

describe("Identify Component", () => {
  let fixture: ComponentFixture<IdentifyComponent>;
  let routerSpy;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [
        RouterModule.forRoot([]),
        FormsModule,
        MatFormFieldModule,
        MatIconModule,
        MatCardModule,
        MatTooltipModule,
        MatInputModule,
        NoopAnimationsModule
      ],
      providers: [
        {
          provide: PassportService,
          useValue: {
            getStrategies: jasmine.createSpy("getStrategies").and.returnValue(
              of([
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
              ])
            ),
            identifyWith: jasmine
              .createSpy("identifyWith", (name: string) =>
                name == "name2" ? throwError({error: {message: "Here is the error."}}) : of(null)
              )
              .and.callThrough(),
            identify: jasmine.createSpy("identify").and.returnValue(of({})),
            identified: true
          }
        }
      ],
      declarations: [IdentifyComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(IdentifyComponent);
    routerSpy = spyOn(fixture.componentInstance.router, "navigate");
    fixture.detectChanges();
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

    it("should navigate if passport identified is true", () => {
      expect(routerSpy).toHaveBeenCalledTimes(1);
      expect(routerSpy).toHaveBeenCalledWith([""]);
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
});
