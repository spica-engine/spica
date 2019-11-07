import {ComponentFixture, TestBed, fakeAsync, tick} from "@angular/core/testing";
import {IdentityAddComponent} from "./identity-add.component";
import {RouterModule, ActivatedRoute} from "@angular/router";
import {PreferencesService} from "../../../../packages/core/preferences/preferences.service";
import {of, throwError} from "rxjs";
import {IdentityService} from "../../services/identity.service";
import {PolicyService} from "../../services/policy.service";
import {
  MatIconModule,
  MatToolbarModule,
  MatFormFieldModule,
  MatInputModule,
  MatTooltipModule,
  MatListModule,
  MatCardModule
} from "@angular/material";
import {FormsModule, NgModel, NgForm} from "@angular/forms";
import {InputModule} from "../../../../packages/common/input/input.module";
import {NoopAnimationsModule} from "@angular/platform-browser/animations";
import {By} from "@angular/platform-browser";

//There is an issue about some async it blocks affects other it blocks

xdescribe("Identity Add Component", () => {
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
            readonly: true,
            options: {
              visible: true
            }
          },
          prop2: {
            type: "string",
            readnly: false,
            options: {
              visible: true
            }
          }
        }
      }
    }
  };

  let identity = {
    _id: "123",
    identifier: "identifier",
    password: "password",
    policies: ["222"],
    attributes: {
      prop1: "attribute1",
      prop2: "attribute2"
    }
  };

  let policy = {
    meta: {total: 2},
    data: [
      {
        _id: "111",
        name: "first policy",
        description: "description of first policy",
        statement: [
          {
            service: "allowed service of first policy",
            effect: "allow",
            action: ["read", "edit"],
            resource: ["res1", "res2"]
          },
          {
            service: "denied service of first policy",
            effect: "deny",
            action: ["create", "delete"],
            resource: ["res3", "res4"]
          }
        ]
      },
      {
        _id: "222",
        name: "second policy",
        description: "description of second policy",
        statement: [
          {
            service: "allowed service of second policy",
            effect: "allow",
            action: ["read"],
            resource: ["res5", "res6"]
          },
          {
            service: "denied service of second policy",
            effect: "deny",
            action: ["edit", "create", "delete"],
            resource: ["res7", "res8"]
          }
        ]
      }
    ]
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [
        RouterModule.forRoot([]),
        MatIconModule,
        MatToolbarModule,
        FormsModule,
        MatFormFieldModule,
        InputModule,
        MatTooltipModule,
        MatListModule,
        MatCardModule,
        MatInputModule,
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
        }
      ],
      declarations: [IdentityAddComponent]
    });

    TestBed.overrideProvider(PolicyService, {
      useValue: {
        find: jasmine.createSpy("find").and.returnValue(of(policy)),
        attachPolicy: {},
        detachPolicy: {}
      }
    });
    TestBed.overrideProvider(IdentityService, {
      useValue: {
        findOne: jasmine.createSpy("findOne").and.returnValue(of(identity)),
        updateOne: {},
        insertOne: {}
      }
    });
    fixture = TestBed.createComponent(IdentityAddComponent);
    fixture.detectChanges();
  });

  xdescribe("basic behaviours", () => {
    it("should render preferences, policies and others", async () => {
      await fixture.whenStable();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

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
        fixture.debugElement.query(
          By.css("div.policies mat-list mat-list-item:first-of-type label")
        ).nativeElement.textContent
      ).toBe("second policy");
      expect(
        fixture.debugElement.query(
          By.css("div.policies mat-list:nth-child(2) mat-list-item:first-of-type label")
        ).nativeElement.textContent
      ).toBe("first policy");

      expect(
        fixture.debugElement.query(By.css("form input:first-of-type")).injector.get(NgModel).value
      ).toBe("identifier");
      expect(fixture.debugElement.query(By.css("form button")).nativeElement.textContent).toBe(
        " Change Password "
      );
    });
  });

  xdescribe("actions", () => {
    it("should attach policy", async () => {
      await fixture.whenStable();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const attachSpy = spyOn(
        fixture.componentInstance["policyService"],
        "attachPolicy"
      ).and.returnValue(of({...identity, policies: ["111", "222"]}));

      await fixture.debugElement
        .query(By.css("div.policies mat-list:nth-child(2) mat-list-item:first-of-type button"))
        .nativeElement.click();
      fixture.detectChanges();

      expect(attachSpy).toHaveBeenCalledTimes(1);
      expect(attachSpy).toHaveBeenCalledWith("111", "123");

      const ownedPolicies = fixture.debugElement
        .queryAll(By.css("div.policies mat-list mat-list-item"))
        .map(item => item.nativeElement.querySelector("label").textContent);

      expect(ownedPolicies).toEqual(["first policy", "second policy"]);
      expect(
        fixture.debugElement.query(By.css("div.policies mat-list:nth-child(2) mat-list-item"))
      ).toBeNull("should be null if there isn't any ownable policy");
    });

    it("should detach policy", async () => {
      await fixture.whenStable();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const detachSpy = spyOn(
        fixture.componentInstance["policyService"],
        "detachPolicy"
      ).and.returnValue(of({...identity, policies: []}));

      await fixture.debugElement
        .query(By.css("div.policies mat-list:first-of-type mat-list-item:first-of-type button"))
        .nativeElement.click();
      fixture.detectChanges();

      expect(detachSpy).toHaveBeenCalledTimes(1);
      expect(detachSpy).toHaveBeenCalledWith("222", "123");

      const ownablePolicies = fixture.debugElement
        .queryAll(By.css("div.policies mat-list:nth-child(2) mat-list-item"))
        .map(item => item.nativeElement.querySelector("label").textContent);

      expect(ownablePolicies).toEqual(["first policy", "second policy"]);
      expect(
        fixture.debugElement.query(By.css("div.policies mat-list:first-of-type mat-list-item"))
      ).toBeNull("should be null if there isn't any owned policy");
    });

    it("should update identity", async () => {
      await fixture.whenStable();
      fixture.detectChanges();

      const updateSpy = spyOn(
        fixture.componentInstance["identityService"],
        "updateOne"
      ).and.returnValue(of(null));
      const navigateSpy = spyOn(fixture.componentInstance["router"], "navigate");
      fixture.componentInstance.changePasswordState = true;

      await fixture.whenStable();
      fixture.detectChanges();

      await fixture.whenStable();
      fixture.detectChanges();

      fixture.debugElement
        .query(By.css("form"))
        .injector.get(NgForm)
        .setValue({
          identifier: "new identifier",
          password: "new password",
          prop1: "attribute1",
          prop1_inner: "attribute1",
          prop2: "new attribute",
          prop2_inner: "new attribute"
        });

      await fixture.debugElement
        .query(By.css("mat-card mat-card-actions button"))
        .nativeElement.click();

      fixture.detectChanges();

      expect(updateSpy).toHaveBeenCalledTimes(1);
      expect(updateSpy).toHaveBeenCalledWith({
        _id: "123",
        identifier: "new identifier",
        password: "new password",
        policies: ["222"],
        attributes: {
          prop1: "attribute1",
          prop2: "new attribute"
        }
      });

      expect(navigateSpy).toHaveBeenCalledTimes(1);
      expect(navigateSpy).toHaveBeenCalledWith(["passport/identity"]);
    });

    it("should create new identity", async () => {
      const newIdentity = (fixture.componentInstance.identity = {
        identifier: "new identifier",
        password: "new password",
        policies: ["111"],
        attributes: {
          prop1: "attribtue1",
          prop2: "attribute2"
        }
      });

      const insertSpy = spyOn(
        fixture.componentInstance["identityService"],
        "insertOne"
      ).and.returnValue(of({...newIdentity, _id: "000"}));

      const replaceStateSpy = spyOn(fixture.componentInstance["location"], "replaceState");

      fixture.detectChanges();
      await fixture.debugElement
        .query(By.css("mat-card mat-card-actions button"))
        .nativeElement.click();

      expect(insertSpy).toHaveBeenCalledTimes(1);
      expect(insertSpy).toHaveBeenCalledWith(newIdentity);

      expect(replaceStateSpy).toHaveBeenCalledTimes(1);
      expect(replaceStateSpy).toHaveBeenCalledWith("passport/identities/000/edit");

      expect(fixture.componentInstance.identity).toEqual({...newIdentity, _id: "000"});
    });
  });

  xdescribe("errors", () => {
    it("should show identifier required error", async () => {
      await fixture.whenStable();

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

    it("should password required error", async () => {
      fixture.debugElement.query(By.css("form button:first-of-type")).nativeElement.click();

      fixture.detectChanges();
      await fixture.whenStable();

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
    });

    it("should show error about inserting new credential", async () => {
      const insertOneSpy = spyOn(
        fixture.componentInstance["identityService"],
        "insertOne"
      ).and.returnValue(throwError("Error from service."));

      await fixture.componentInstance.createIdentity();

      fixture.detectChanges();

      expect(insertOneSpy).toHaveBeenCalledTimes(1);
      expect(fixture.debugElement.query(By.css("form mat-error")).nativeElement.textContent).toBe(
        "Error from service."
      );
    });
  });
});
