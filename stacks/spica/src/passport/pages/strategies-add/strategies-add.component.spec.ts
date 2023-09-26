import {ComponentFixture, fakeAsync, TestBed, tick} from "@angular/core/testing";
import {FormsModule, NgModel} from "@angular/forms";
import {MatCardModule} from "@angular/material/card";
import {MatExpansionModule} from "@angular/material/expansion";
import {MatFormFieldModule} from "@angular/material/form-field";
import {MatIconModule} from "@angular/material/icon";
import {MatInputModule} from "@angular/material/input";
import {MatMenuModule} from "@angular/material/menu";
import {MatToolbarModule} from "@angular/material/toolbar";
import {MatTooltipModule} from "@angular/material/tooltip";
import {MatPaginatorModule} from "@angular/material/paginator";
import {By} from "@angular/platform-browser";
import {NoopAnimationsModule} from "@angular/platform-browser/animations";
import {ActivatedRoute} from "@angular/router";
import {RouterTestingModule} from "@angular/router/testing";
import {of, throwError} from "rxjs";
import {StrategyService} from "../../services/strategy.service";
import {StrategiesAddComponent} from "./strategies-add.component";
import {MatSelectModule} from "@angular/material/select";

describe("Strategies Add Component", () => {
  let fixture: ComponentFixture<StrategiesAddComponent>;
  let strategiesService: jasmine.SpyObj<Partial<StrategyService>>;
  let navigateSpy;

  beforeEach(fakeAsync(() => {
    strategiesService = {
      getStrategy: jasmine.createSpy("getStrategies").and.returnValue(
        of({
          _id: "1",
          type: "saml",
          name: "strategy name",
          title: "strategy title",
          icon: "strategy icon",
          callbackUrl: "strategy callbackUrl",
          options: {
            ip: {
              login_url: "login url",
              logout_url: "logout url",
              certificate: "ip certificate"
            },
            sp: {
              certificate: "sp certificate",
              private_key: "private key"
            }
          }
        })
      ),
      updateStrategy: null
    };

    TestBed.configureTestingModule({
      imports: [
        RouterTestingModule,
        MatMenuModule,
        MatIconModule,
        MatTooltipModule,
        MatPaginatorModule,
        MatToolbarModule,
        MatCardModule,
        MatFormFieldModule,
        FormsModule,
        MatExpansionModule,
        MatInputModule,
        NoopAnimationsModule,
        MatSelectModule
      ],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            params: of({id: "id1"})
          }
        }
      ],
      declarations: [StrategiesAddComponent]
    });
    TestBed.overrideProvider(StrategyService, {useValue: strategiesService});

    fixture = TestBed.createComponent(StrategiesAddComponent);

    navigateSpy = spyOn(fixture.componentInstance["router"], "navigate");

    fixture.detectChanges();
    tick();
    fixture.detectChanges();
  }));

  describe("basic behaviours", () => {
    it("should show properties of strategy", () => {
      expect(
        fixture.debugElement
          .query(By.css("mat-mdc-card-content mat-form-field:nth-child(1) input"))
          .injector.get(NgModel).value
      ).toBe("strategy callbackUrl", "should show strategy callback url value");

      expect(
        fixture.debugElement
          .query(By.css("mat-mdc-card-content mat-form-field:nth-child(2) input"))
          .injector.get(NgModel).value
      ).toBe("strategy name", "should show strategy name value");

      expect(
        fixture.debugElement
          .query(By.css("mat-mdc-card-content mat-form-field:nth-child(3) input"))
          .injector.get(NgModel).value
      ).toBe("strategy title", "should show strategy title value");

      expect(
        fixture.debugElement
          .query(By.css("mat-mdc-card-content mat-form-field:nth-child(4) mat-select"))
          .injector.get(NgModel).value
      ).toBe("saml", "should show strategy type value");

      expect(
        fixture.debugElement
          .query(By.css("mat-mdc-card-content mat-form-field:nth-child(5) input"))
          .injector.get(NgModel).value
      ).toBe("login url", "should show strategy options ip login url value");

      expect(
        fixture.debugElement
          .query(By.css("mat-mdc-card-content mat-form-field:nth-child(6) input"))
          .injector.get(NgModel).value
      ).toBe("logout url", "should show strategy options ip logout url value");

      expect(
        fixture.debugElement
          .query(By.css("mat-mdc-card-content mat-form-field:nth-child(7) textarea"))
          .injector.get(NgModel).value
      ).toBe("ip certificate", "should show strategy options ip certifivate value");

      expect(
        fixture.debugElement
          .query(By.css("mat-mdc-accordion mat-form-field:nth-child(1) textarea"))
          .injector.get(NgModel).value
      ).toBe("sp certificate", "should show strategy options sp certificate value");

      expect(
        fixture.debugElement
          .query(By.css("mat-mdc-accordion mat-form-field:nth-child(2) textarea"))
          .injector.get(NgModel).value
      ).toBe("private key", "should show strategy options sp private key value");
    });
  });

  describe("actions", () => {
    it("should update strategy", fakeAsync(() => {
      //update certificate
      fixture.debugElement
        .query(By.css("mat-mdc-card-content mat-form-field:nth-child(2) input"))
        .injector.get(NgModel)
        .control.setValue("new name");

      fixture.debugElement
        .query(By.css("mat-mdc-card-content mat-form-field:nth-child(3) input"))
        .injector.get(NgModel)
        .control.setValue("new title");

      fixture.debugElement
        .query(By.css("mat-mdc-card-content mat-form-field:nth-child(5) input"))
        .injector.get(NgModel)
        .control.setValue("new login url");

      fixture.debugElement
        .query(By.css("mat-mdc-card-content mat-form-field:nth-child(6) input"))
        .injector.get(NgModel)
        .control.setValue("new logout url");

      fixture.debugElement
        .query(By.css("mat-mdc-card-content mat-form-field:nth-child(7) textarea"))
        .injector.get(NgModel)
        .control.setValue("new ip certificate");

      const updateSpy = spyOn(
        fixture.componentInstance["strategyService"],
        "updateStrategy"
      ).and.returnValue(of(null));

      fixture.debugElement.query(By.css("mat-mdc-card-actions button")).nativeElement.click();
      tick();
      fixture.detectChanges();

      expect(updateSpy).toHaveBeenCalledTimes(1);
      expect(updateSpy).toHaveBeenCalledWith("1", {
        _id: "1",
        type: "saml",
        name: "new name",
        title: "new title",
        icon: "strategy icon",
        options: {
          ip: {
            login_url: "new login url",
            logout_url: "new logout url",
            certificate: "new ip certificate"
          },
          sp: {
            certificate: "sp certificate",
            private_key: "private key"
          }
        }
      });

      expect(navigateSpy).toHaveBeenCalledTimes(1);
      expect(navigateSpy).toHaveBeenCalledWith(["passport/strategies"]);
    }));
  });
});
