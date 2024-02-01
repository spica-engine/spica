import {ComponentFixture, fakeAsync, TestBed, tick} from "@angular/core/testing";
import {FormsModule, NgForm, NgModel} from "@angular/forms";
import {MatButtonModule} from "@angular/material/button";
import {MatCardModule} from "@angular/material/card";
import {MatFormFieldModule} from "@angular/material/form-field";
import {MatIconModule} from "@angular/material/icon";
import {MatInputModule} from "@angular/material/input";
import {MatListModule} from "@angular/material/list";
import {MatToolbarModule} from "@angular/material/toolbar";
import {MatTooltipModule} from "@angular/material/tooltip";
import {By} from "@angular/platform-browser";
import {NoopAnimationsModule} from "@angular/platform-browser/animations";
import {ActivatedRoute, Router} from "@angular/router";
import {PassportService} from "src/passport/services/passport.service";
import {of, throwError} from "rxjs";
import {InputModule} from "../../../../packages/common/input/input.module";
import {PreferencesService} from "../../../../packages/core/preferences/preferences.service";
import {CanInteractDirectiveTest} from "@spica-client/passport/directives/can-interact.directive";
import {IdentityService} from "../../services/identity.service";
import {PolicyService} from "../../services/policy.service";
import {IdentityAddComponent} from "./identity-add.component";

describe("Identity Add Component", () => {
  let fixture: ComponentFixture<IdentityAddComponent>;
  let preferencesMeta = {
    _id: "123",
    scope: "scope",
    identity: {
      attributes: {
        required: ["prop1"],
        properties: {
          prop1: {
            type: "string",
            readOnly: true
          },
          prop2: {
            type: "string",
            readOnly: false
          }
        }
      }
    }
  };

  let identityService: jasmine.SpyObj<Partial<IdentityService>>,
    policyService: jasmine.SpyObj<Partial<PolicyService>>,
    passportService: jasmine.SpyObj<Partial<PassportService>>,
    router: jasmine.SpyObj<Partial<Router>>;

  beforeEach(async () => {
    router = {
      navigate: jasmine.createSpy("navigate")
    };

    identityService = {
      findOne: jasmine.createSpy("findOne").and.returnValue(
        of({
          _id: "1",
          identifier: "identifier",
          password: "password",
          policies: ["bucket"],
          attributes: {
            prop1: "attribute1",
            prop2: "attribute2"
          }
        })
      ),
      updateOne: null,
      insertOne: null,
      getAuthFactorSchemas: jasmine.createSpy("getAuthFactorSchemas").and.returnValue(of([]))
    };

    passportService = {
      checkAllowed: jasmine.createSpy("checkAllowed").and.returnValue(of(true))
    };

    policyService = {
      find: jasmine.createSpy("find").and.returnValue(
        of({
          meta: {total: 2},
          data: [
            {
              _id: "bucket",
              name: "bucket",
              description: "description of first policy",
              statement: [
                {
                  service: "allowed service of first policy",
                  effect: "allow",
                  action: [],
                  resource: []
                }
              ]
            },
            {
              _id: "function",
              name: "function",
              description: "description of second policy",
              statement: [
                {
                  service: "allowed service of second policy",
                  effect: "allow",
                  action: [],
                  resource: []
                }
              ]
            }
          ]
        })
      ),
      attachPolicy: null,
      detachPolicy: null
    };

    TestBed.configureTestingModule({
      imports: [
        MatIconModule,
        MatToolbarModule,
        MatFormFieldModule,
        InputModule,
        MatTooltipModule,
        MatListModule,
        MatCardModule,
        MatInputModule,
        FormsModule,
        MatButtonModule,
        NoopAnimationsModule
      ],
      providers: [
        {
          provide: Location,
          useValue: {
            replaceState: {}
          }
        },
        {
          provide: PreferencesService,
          useValue: {
            get: jasmine.createSpy("get").and.returnValue(of(preferencesMeta))
          }
        },
        {
          provide: ActivatedRoute,
          useValue: {
            params: of({
              id: "id1"
            })
          }
        },
        {provide: Router, useValue: router}
      ],
      declarations: [IdentityAddComponent, CanInteractDirectiveTest]
    });
    TestBed.overrideProvider(PolicyService, {useValue: policyService});
    TestBed.overrideProvider(IdentityService, {useValue: identityService});
    TestBed.overrideProvider(PassportService, {useValue: passportService});

    fixture = TestBed.createComponent(IdentityAddComponent);
    fixture.detectChanges();

    await fixture.whenStable();
    fixture.detectChanges();
  });

  describe("basic behaviors", () => {
    it("should render preferences, policies and others", () => {
      const prop1 = fixture.debugElement
        .query(By.css("form > div:first-of-type"))
        .injector.get(NgModel);

      expect(prop1.name).toBe("prop1");
      expect(prop1.disabled).toBe(true);
      expect(prop1.value).toBe("attribute1");

      const prop2 = fixture.debugElement.queryAll(By.css("form > div"))[1].injector.get(NgModel);

      expect(prop2.name).toBe("prop2");
      expect(prop2.disabled).toBe(false);
      expect(prop2.value).toBe("attribute2");
      expect(
        fixture.debugElement.query(By.css("form input:first-of-type")).injector.get(NgModel).value
      ).toBe("identifier");
      expect(fixture.debugElement.query(By.css("form button")).nativeElement.textContent).toBe(
        " Change Password "
      );

      const button = fixture.debugElement.nativeElement.querySelector(
        "div.actions button:nth-of-type(2)"
      );
      button.click();
      fixture.detectChanges();

      expect(
        fixture.debugElement.query(
          By.css("div.policies mat-list mat-list-item:first-of-type label")
        ).nativeElement.textContent
      ).toBe("bucket");
      expect(
        fixture.debugElement.query(
          By.css("div.policies mat-list:nth-of-type(2) mat-list-item:first-of-type label")
        ).nativeElement.textContent
      ).toBe("function");
    });
  });

  describe("actions", () => {
    it("should attach policy", fakeAsync(() => {
      const attachSpy = spyOn(policyService, "attachPolicy").and.returnValue(
        of({
          ...fixture.componentInstance.identity,
          policies: ["bucket", "function"]
        })
      );

      const button = fixture.debugElement.nativeElement.querySelector(
        "div.actions button:nth-of-type(2)"
      );
      button.click();
      tick();
      fixture.detectChanges();
      fixture.debugElement
        .query(By.css("div.policies mat-list:nth-of-type(2) mat-list-item:first-of-type button"))
        .nativeElement.click();

      tick();
      fixture.detectChanges(false);

      expect(attachSpy).toHaveBeenCalledTimes(1);
      expect(attachSpy).toHaveBeenCalledWith("function", "1");

      const ownedPolicies = fixture.debugElement
        .queryAll(By.css("div.policies mat-list mat-list-item"))
        .map(item => item.nativeElement.querySelector("label").textContent);

      expect(ownedPolicies).toEqual(["bucket", "function"]);
      expect(
        fixture.debugElement.query(By.css("div.policies mat-list:last-of-type mat-list-item"))
      ).toBeNull("if there isn't any ownable policy");
    }));

    it("should detach policy", fakeAsync(() => {
      const detachSpy = spyOn(policyService, "detachPolicy").and.returnValue(
        of({...fixture.componentInstance.identity, policies: []})
      );

      const button = fixture.debugElement.nativeElement.querySelector(
        "div.actions button:nth-of-type(2)"
      );
      button.click();
      tick();
      fixture.detectChanges();

      fixture.debugElement
        .query(By.css("div.policies mat-list:first-of-type mat-list-item:first-of-type button"))
        .nativeElement.click();

      tick();
      fixture.detectChanges(false);

      expect(detachSpy).toHaveBeenCalledTimes(1);
      expect(detachSpy).toHaveBeenCalledWith("bucket", "1");

      const ownablePolicies = fixture.debugElement
        .queryAll(By.css("div.policies mat-list:nth-of-type(2) mat-list-item"))
        .map(item => item.nativeElement.querySelector("label").textContent);

      expect(ownablePolicies).toEqual(["bucket", "function"]);
      expect(
        fixture.debugElement.query(By.css("div.policies mat-list:first-of-type mat-list-item"))
      ).toBeNull("if there isn't any owned policy");
    }));

    it("should create new identity", fakeAsync(() => {
      const identity = (fixture.componentInstance.identity = {
        identifier: "new identifier",
        password: "new password",
        policies: ["function"],
        attributes: {
          prop1: "attribtue1",
          prop2: "attribute2"
        }
      });
      fixture.detectChanges();

      // Wait for ngModel to propagate changes
      tick();
      fixture.detectChanges();

      const insertSpy = spyOn(identityService, "insertOne").and.returnValue(
        of({...identity, _id: "1"})
      );

      fixture.debugElement.query(By.css("mat-card mat-card-actions button")).nativeElement.click();
      tick();

      expect(insertSpy).toHaveBeenCalledTimes(1);
      expect(insertSpy).toHaveBeenCalledWith(identity);
      delete identity.password;
      expect(fixture.componentInstance.identity).toEqual({
        ...identity,
        _id: "1"
      });

      expect(router.navigate).toHaveBeenCalledTimes(1);
      expect(router.navigate).toHaveBeenCalledWith(["passport", "identity", "1", "edit"]);
    }));
  });

  describe("errors", () => {
    it("should show identifier required error", async () => {
      const input = fixture.debugElement
        .query(By.css("form mat-form-field:first-of-type input"))
        .injector.get(NgModel);
      input.control.reset();
      input.control.markAsTouched();

      fixture.detectChanges();

      expect(
        fixture.debugElement.query(By.css("form mat-form-field:first-of-type mat-error"))
          .nativeElement.textContent
      ).toBe("This field is required.");
    });

    it("should password required error", fakeAsync(() => {
      // Open up the password field
      fixture.debugElement.query(By.css("form button:first-of-type")).nativeElement.click();
      fixture.detectChanges(false);

      // Wait for ngModel to propagate changes
      tick();
      fixture.detectChanges();

      const input = fixture.debugElement
        .query(By.css("form mat-form-field:nth-child(2) input"))
        .injector.get(NgModel);

      expect(input.value).toBe("password");

      input.control.reset();
      input.control.markAsTouched();

      fixture.detectChanges();

      expect(
        fixture.debugElement.query(By.css("form mat-form-field:nth-child(2) mat-error"))
          .nativeElement.textContent
      ).toBe("This field is required.");
    }));

    it("should show error about inserting new credential", fakeAsync(() => {
      fixture.componentInstance.identity._id = undefined;
      const insertOneSpy = spyOn(identityService, "insertOne").and.returnValue(
        throwError({error: {message: "Error from service."}})
      );

      fixture.componentInstance.upsertIdentity();

      tick();
      fixture.detectChanges();

      expect(insertOneSpy).toHaveBeenCalledTimes(1);
      expect(fixture.debugElement.query(By.css("form mat-error")).nativeElement.textContent).toBe(
        "Error from service."
      );
    }));
  });
});
